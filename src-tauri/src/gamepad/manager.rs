use std::sync::Arc;

use gilrs::{Gilrs, Event as GilrsEvent, EventType, Axis, Button};
use parking_lot::RwLock;

use crate::protocol::types::JoystickState;
use crate::protocol::connection::{GamepadInfo, GamepadUpdate};

/// Maps gilrs axis to our axis index (matching WPILib convention)
/// Supports gamepads (6 axes) and flight sticks (X, Y, Twist, Throttle)
fn axis_index(axis: Axis) -> Option<usize> {
    match axis {
        Axis::LeftStickX => Some(0),   // X / Roll
        Axis::LeftStickY => Some(1),   // Y / Pitch
        Axis::LeftZ => Some(2),        // Left trigger / Twist
        Axis::RightStickX => Some(3),  // Right stick X / Slider
        Axis::RightStickY => Some(4),  // Right stick Y
        Axis::RightZ => Some(5),       // Right trigger / Throttle
        _ => None,
    }
}

/// Maps gilrs button to our button index (matching WPILib convention)
/// Supports gamepads (A/B/X/Y + shoulders) and flight sticks (numbered buttons)
fn button_index(button: Button) -> Option<usize> {
    match button {
        Button::South => Some(0),           // A / Cross / Trigger
        Button::East => Some(1),            // B / Circle / Button 2
        Button::West => Some(2),            // X / Square / Button 3
        Button::North => Some(3),           // Y / Triangle / Button 4
        Button::LeftTrigger => Some(4),     // LB / Button 5
        Button::RightTrigger => Some(5),    // RB / Button 6
        Button::Select => Some(6),          // Back / Button 7
        Button::Start => Some(7),           // Start / Button 8
        Button::LeftThumb => Some(8),       // L3 / Button 9
        Button::RightThumb => Some(9),      // R3 / Button 10
        Button::LeftTrigger2 => Some(10),   // LT digital / Button 11
        Button::RightTrigger2 => Some(11),  // RT digital / Button 12
        Button::C => Some(12),              // Button 13
        Button::Z => Some(13),              // Button 14
        Button::Mode => Some(14),           // Guide / Button 15
        Button::Unknown => Some(15),        // Unknown / Button 16
        _ => None,
    }
}

/// Converts D-pad button states to a POV angle (WPILib convention)
/// -1 = not pressed, 0 = up, 45 = up-right, 90 = right, etc.
fn dpad_to_pov(up: bool, right: bool, down: bool, left: bool) -> i16 {
    match (up, right, down, left) {
        (true, false, false, false) => 0,
        (true, true, false, false) => 45,
        (false, true, false, false) => 90,
        (false, true, true, false) => 135,
        (false, false, true, false) => 180,
        (false, false, true, true) => 225,
        (false, false, false, true) => 270,
        (true, false, false, true) => 315,
        _ => -1,
    }
}

/// Internal tracking of a connected gamepad
struct TrackedGamepad {
    gilrs_id: gilrs::GamepadId,
    name: String,
    slot: usize,
    state: JoystickState,
    dpad_up: bool,
    dpad_right: bool,
    dpad_down: bool,
    dpad_left: bool,
}

/// Manages gamepad enumeration and input polling
pub struct GamepadManager {
    gilrs: Gilrs,
    gamepads: Vec<TrackedGamepad>,
    joystick_state: Arc<RwLock<Vec<JoystickState>>>,
    /// Maps slot index → device name for locked slots
    locked_slots: std::collections::HashMap<usize, String>,
}

impl GamepadManager {
    pub fn new(joystick_state: Arc<RwLock<Vec<JoystickState>>>) -> Self {
        let gilrs = Gilrs::new().expect("Failed to initialize gilrs");

        let mut manager = Self {
            gilrs,
            gamepads: Vec::new(),
            joystick_state,
            locked_slots: std::collections::HashMap::new(),
        };

        // Enumerate already-connected gamepads
        manager.enumerate_gamepads();
        manager
    }

    /// Find the first available slot (0-5) not occupied and not locked-reserved
    fn first_available_slot(&self) -> usize {
        let used: std::collections::HashSet<usize> =
            self.gamepads.iter().map(|g| g.slot).collect();
        (0..6)
            .find(|s| !used.contains(s) && !self.locked_slots.contains_key(s))
            .unwrap_or(self.gamepads.len())
    }

    /// Find the locked slot for a device by name, if any
    fn find_locked_slot(&self, name: &str) -> Option<usize> {
        self.locked_slots.iter()
            .find(|(_, locked_name)| locked_name.as_str() == name)
            .map(|(&slot, _)| slot)
    }

    fn enumerate_gamepads(&mut self) {
        self.gamepads.clear();
        for (id, gamepad) in self.gilrs.gamepads() {
            if gamepad.is_connected() {
                let slot = self.first_available_slot();
                self.gamepads.push(TrackedGamepad {
                    gilrs_id: id,
                    name: gamepad.name().to_string(),
                    slot,
                    state: JoystickState::default(),
                    dpad_up: false,
                    dpad_right: false,
                    dpad_down: false,
                    dpad_left: false,
                });
            }
        }
        self.sync_joystick_state();
    }

    /// Poll for gamepad events and update state. Call at ~50Hz.
    pub fn poll(&mut self) -> Option<GamepadUpdate> {
        let mut changed = false;

        // Process all pending events
        while let Some(GilrsEvent { id, event, .. }) = self.gilrs.next_event() {
            match event {
                EventType::Connected => {
                    let gamepad = self.gilrs.gamepad(id);
                    let name = gamepad.name().to_string();
                    // Check if this device has a locked slot
                    let slot = if let Some(locked) = self.find_locked_slot(&name) {
                        locked
                    } else {
                        self.first_available_slot()
                    };
                    self.gamepads.push(TrackedGamepad {
                        gilrs_id: id,
                        name: name.clone(),
                        slot,
                        state: JoystickState::default(),
                        dpad_up: false,
                        dpad_right: false,
                        dpad_down: false,
                        dpad_left: false,
                    });
                    changed = true;
                    tracing::info!("Gamepad connected: {} (slot {})", name, slot);
                }
                EventType::Disconnected => {
                    // If slot is locked, keep the reservation but remove the gamepad
                    self.gamepads.retain(|g| g.gilrs_id != id);
                    changed = true;
                    tracing::info!("Gamepad disconnected");
                }
                EventType::AxisChanged(axis, value, _) => {
                    if let Some(gp) = self.gamepads.iter_mut().find(|g| g.gilrs_id == id) {
                        if let Some(idx) = axis_index(axis) {
                            if idx < gp.state.axes.len() {
                                gp.state.axes[idx] = value;
                            }
                        }
                    }
                }
                EventType::ButtonChanged(button, value, _) => {
                    if let Some(gp) = self.gamepads.iter_mut().find(|g| g.gilrs_id == id) {
                        let pressed = value > 0.5;
                        // Handle D-pad buttons → POV
                        match button {
                            Button::DPadUp => gp.dpad_up = pressed,
                            Button::DPadRight => gp.dpad_right = pressed,
                            Button::DPadDown => gp.dpad_down = pressed,
                            Button::DPadLeft => gp.dpad_left = pressed,
                            _ => {
                                if let Some(idx) = button_index(button) {
                                    if idx < gp.state.buttons.len() {
                                        gp.state.buttons[idx] = pressed;
                                    }
                                }
                            }
                        }
                        // Update POV from D-pad state
                        if !gp.state.povs.is_empty() {
                            gp.state.povs[0] = dpad_to_pov(
                                gp.dpad_up, gp.dpad_right, gp.dpad_down, gp.dpad_left,
                            );
                        }
                    }
                }
                _ => {}
            }
        }

        self.sync_joystick_state();

        if changed {
            Some(self.get_gamepad_update())
        } else {
            None
        }
    }

    /// Sync internal gamepad state to the shared joystick state for the protocol loop
    fn sync_joystick_state(&self) {
        let mut js = self.joystick_state.write();
        // Find max slot to size the vector
        let max_slot = self.gamepads.iter().map(|g| g.slot).max().unwrap_or(0);
        js.clear();
        js.resize(max_slot + 1, JoystickState::default());
        for gp in &self.gamepads {
            if gp.slot < js.len() {
                js[gp.slot] = gp.state.clone();
            }
        }
    }

    /// Move gamepad from one slot to another. If target slot is occupied, swap.
    pub fn move_to_slot(&mut self, from_slot: usize, to_slot: usize) {
        if from_slot == to_slot || from_slot >= 6 || to_slot >= 6 {
            return;
        }

        let from_idx = self.gamepads.iter().position(|g| g.slot == from_slot);
        let to_idx = self.gamepads.iter().position(|g| g.slot == to_slot);

        match (from_idx, to_idx) {
            (Some(fi), Some(ti)) => {
                // Both slots occupied — swap
                self.gamepads[fi].slot = to_slot;
                self.gamepads[ti].slot = from_slot;
            }
            (Some(fi), None) => {
                // Target is empty — move
                self.gamepads[fi].slot = to_slot;
            }
            _ => {} // Source is empty, nothing to do
        }

        self.sync_joystick_state();
    }

    pub fn get_gamepad_update(&self) -> GamepadUpdate {
        GamepadUpdate {
            gamepads: self
                .gamepads
                .iter()
                .map(|gp| GamepadInfo {
                    id: gp.slot,
                    name: gp.name.clone(),
                    slot: gp.slot,
                    axes: gp.state.axes.clone(),
                    buttons: gp.state.buttons.clone(),
                    povs: gp.state.povs.clone(),
                    locked: self.locked_slots.contains_key(&gp.slot),
                })
                .collect(),
        }
    }

    /// Lock a slot to its current device name
    pub fn lock_slot(&mut self, slot: usize) {
        if let Some(gp) = self.gamepads.iter().find(|g| g.slot == slot) {
            tracing::info!("Locking slot {} to '{}'", slot, gp.name);
            self.locked_slots.insert(slot, gp.name.clone());
        }
    }

    /// Unlock a slot
    pub fn unlock_slot(&mut self, slot: usize) {
        if self.locked_slots.remove(&slot).is_some() {
            tracing::info!("Unlocked slot {}", slot);
        }
    }

    /// Get locked slots info for the frontend (slot → device name)
    pub fn get_locked_slots(&self) -> &std::collections::HashMap<usize, String> {
        &self.locked_slots
    }

    pub fn gamepad_count(&self) -> usize {
        self.gamepads.len()
    }
}
