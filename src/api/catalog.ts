/** Catalog endpoints. */

import { Client } from "../client.ts";
import {
  type AnimationModels,
  type SoundModels,
  type SpriteModels,
  decodeAnimationModels,
  decodeSoundModels,
  decodeSpriteModels,
} from "../models/index.ts";
import { Concurrency } from "../rate-limit.ts";

declare module "../client.ts" {
  interface Client {
    /** Returns the image-model catalog and prompt-enhancement models. `GET /sprite-models` */
    spriteModels(): Promise<SpriteModels>;
    /** Returns the sound-model catalog and output formats. `GET /sound-models` */
    soundModels(): Promise<SoundModels>;
    /** Returns the animation models by public name. `GET /animation-models` */
    animationModels(): Promise<AnimationModels>;
  }
}

Client.prototype.spriteModels = function (this: Client): Promise<SpriteModels> {
  return this.sendJson(
    "tier2",
    "GET /sprite-models",
    Concurrency.NONE,
    { method: "GET", path: "sprite-models" },
    decodeSpriteModels,
  );
};

Client.prototype.soundModels = function (this: Client): Promise<SoundModels> {
  return this.sendJson(
    "tier2",
    "GET /sound-models",
    Concurrency.NONE,
    { method: "GET", path: "sound-models" },
    decodeSoundModels,
  );
};

Client.prototype.animationModels = function (this: Client): Promise<AnimationModels> {
  return this.sendJson(
    "tier2",
    "GET /animation-models",
    Concurrency.NONE,
    { method: "GET", path: "animation-models" },
    decodeAnimationModels,
  );
};
