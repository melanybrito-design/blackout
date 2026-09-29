// Colisiones simples: cajas AABB contra un círculo (jugador/entidades) en el plano XZ.

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  enabled: boolean;
}

export class CollisionWorld {
  readonly boxes: AABB[] = [];

  add(minX: number, maxX: number, minZ: number, maxZ: number, minY = 0, maxY = 3): AABB {
    const box: AABB = {
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
      minY,
      maxY,
      enabled: true,
    };
    this.boxes.push(box);
    return box;
  }

  /** Empuja la posición (x, z) fuera de las cajas. Devuelve true si hubo contacto. */
  resolve(pos: { x: number; z: number }, radius: number, feetY = 0, headY = 1.7): boolean {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.boxes) {
        if (!b.enabled || b.maxY <= feetY + 0.35 || b.minY >= headY) continue;
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // Centro dentro de la caja: salir por el lado más cercano.
          const left = pos.x - b.minX;
          const right = b.maxX - pos.x;
          const back = pos.z - b.minZ;
          const front = b.maxZ - pos.z;
          const m = Math.min(left, right, back, front);
          if (m === left) pos.x = b.minX - radius;
          else if (m === right) pos.x = b.maxX + radius;
          else if (m === back) pos.z = b.minZ - radius;
          else pos.z = b.maxZ + radius;
        }
      }
    }
    return hit;
  }

  /** ¿El segmento a→b (en XZ, a la altura dada) cruza alguna caja? Para visibilidad. */
  blocked(ax: number, az: number, bx: number, bz: number, y = 1.5): boolean {
    for (const b of this.boxes) {
      if (!b.enabled || y < b.minY || y > b.maxY) continue;
      if (segmentHitsBox(ax, az, bx, bz, b)) return true;
    }
    return false;
  }
}

function segmentHitsBox(ax: number, az: number, bx: number, bz: number, b: AABB): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return (
    clip(-dx, ax - b.minX) && clip(dx, b.maxX - ax) && clip(-dz, az - b.minZ) && clip(dz, b.maxZ - az) && t0 <= t1
  );
}
