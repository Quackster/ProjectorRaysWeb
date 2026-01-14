/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Score module - Timeline and channel management

export const SCORE_MODULE_VERSION: i32 = 1;

// Export score types
export { Channel, InkType, SpriteType, ChannelFlags } from "./Channel";
export { Frame, TransitionType, CastMemberRef } from "./Frame";
export { Score, Label } from "./Score";
