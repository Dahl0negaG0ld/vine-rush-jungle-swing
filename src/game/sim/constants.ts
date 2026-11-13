// Feel constants for VINE RUSH. All units are metres / seconds.
// Forward convention: yaw 0 faces +Z, forward = (sin yaw, 0, cos yaw),
// screen-right = (-cos yaw, 0, sin yaw).

export const G = 9.81;
export const DT = 1 / 120; // fixed sim step
export const MAX_FRAME = 0.05; // clamp per rendered frame

// Player body
export const HAND_OFFSET = 0.6; // hands sit this far above the eyes
export const FALL_Y = 1.9; // hands below this height = hit the jungle floor

// Grabbing
export const GRAB_RADIUS = 3.0; // max hand-to-vine distance for a grab
export const ASSIST_RADIUS = 7; // while reaching, drift toward vines inside this
export const ASSIST_ACCEL = 8;
export const VERTICAL_REACH = 0.7; // <1: you can stretch further up/down than sideways
export const MIN_ROPE = 7; // top of each vine is lost in the canopy: no grabbing there
export const ROPE_FLOOR = 2.5; // shortest rope possible after a high grab
export const SLIDE_SPEED = 5; // m/s the hands slide down a vine grabbed too high
export const REGRAB_COOLDOWN = 0.6; // s before the vine you left can be grabbed again
export const TARGET_STICKY = 3; // keep the current target unless another is clearly better
export const TARGET_LOOK = 24; // how far ahead vines are considered targets

// Forces
export const SWING_STEER = 3.2; // body-weight shift while hanging
export const AIR_STEER = 4;
export const PUMP_ACCEL = 3.2; // leaning into the swing adds energy
export const HEADING_FOLLOW = 2.5; // view yaw eases toward the corridor heading
export const HEADING_MAX_OFF = 0.35; // max look offset toward the travel direction
export const STEER_LOOK = 0.15; // view turns slightly into a steer
export const DRAG = 0.025;
export const AIR_DRAG_QUAD = 0.01;
export const MAX_SPEED = 17; // hard cap keeps swings readable // speed-squared drag: tames runaway speed
export const SWING_DAMP = 0.015;

// Release
export const RELEASE_UP = 0.5; // pull-up kick when letting go
export const RELEASE_BOOST = 0.5; // forward kick when letting go

// Course
export const ANCHOR_Y_MIN = 21.5;
export const ANCHOR_Y_MAX = 24;
export const VINE_LEN_MIN = 11;
export const VINE_LEN_MAX = 15;
export const SPACING_MIN = 10;
export const SPACING_MAX = 13;
export const SPACING_RAMP = 4; // extra max spacing reached at RAMP_DIST
export const RAMP_DIST = 600;
export const LATERAL_JITTER = 2.2;
export const SIDE_VINE_CHANCE = 0.3;
export const GEN_AHEAD = 150;
export const PRUNE_BEHIND = 30;
