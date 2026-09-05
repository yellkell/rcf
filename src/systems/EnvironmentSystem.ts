/**
 * EnvironmentSystem — keeper of the places (FOUNDATION.md pillar 1).
 *
 * Builds a place, hangs it in the scene, sets the sky, fog and the shadow
 * map (baked ONCE: nothing that casts a shadow ever moves, the FF2 desert's
 * trick), plants the player on the spawn, and breathes the place each
 * frame. Swapping places is a visibility flip; the rest of the game reads
 * the place through env/place.ts.
 */

import { createSystem } from '@iwsdk/core';
import { Fog, PMREMGenerator, type Scene } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildGarden } from '../env/garden.js';
import { setPlace, type Place } from '../env/place.js';
import { teleportPlayer } from './TeleportSystem.js';

export type PlaceId = 'garden';

const BUILDERS: Record<PlaceId, () => Place> = {
  garden: buildGarden,
};

export const environmentView: { load?: (id: PlaceId) => void; current?: () => PlaceId | null } = {};

export class EnvironmentSystem extends createSystem({}) {
  private place: Place | null = null;
  private id: PlaceId | null = null;
  private time = 0;
  private shadowsBaked = false;

  init(): void {
    const scene = this.scene as Scene;
    // Image-based light for the shells and the water; the sun does the rest.
    scene.environment = new PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    environmentView.load = (id) => this.load(id);
    environmentView.current = () => this.id;
    this.load('garden');
  }

  load(id: PlaceId): void {
    if (this.place) {
      this.place.root.visible = false;
      this.place.dispose?.();
      this.place.root.removeFromParent();
    }
    const place = BUILDERS[id]();
    this.place = place;
    this.id = id;
    this.scene.add(place.root);
    const scene = this.scene as Scene;
    scene.background = place.sky;
    scene.fog = new Fog(place.sky.getHex(), 18, 140);
    this.shadowsBaked = false;
    setPlace(place);
    teleportPlayer(this.player, place.spawn.x, place.spawn.z, place.spawn.yaw, place.spawn.y ?? 0);
  }

  update(delta: number): void {
    if (!this.place) return;
    if (!this.shadowsBaked) {
      // One bake, after the first frame has laid the world out.
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsBaked = true;
    }
    this.time += delta;
    this.place.update?.(delta, this.time);
  }
}
