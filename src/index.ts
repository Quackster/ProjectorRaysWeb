/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Director Web Player
 *
 * A browser-based player for Macromedia/Adobe Director movies.
 *
 * @example
 * ```typescript
 * import { MoviePlayer } from 'director-web-player';
 *
 * const player = new MoviePlayer();
 * await player.init(document.getElementById('stage'));
 * await player.loadFromURL('/movies/demo.dir');
 * player.play();
 * ```
 */

// Bridge layer
export * from './bridge/index.js';

// Render layer
export * from './render/index.js';

// Player
export * from './player/index.js';

// Xtra system
export * from './xtra/index.js';
