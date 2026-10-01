import * as THREE from 'three';

/** Carga una imagen opcional de `public/assets/`; si falta el archivo, no llama a `onLoad`. */
export function optionalImage(path: string, onLoad: (image: HTMLImageElement) => void): void {
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => onLoad(image);
  image.src = `/assets/${path}`;
}

/** Conserva la textura procedural hasta que el archivo opcional termina de cargar. */
export function optionalTexture(fallback: THREE.Texture, path: string, onLoad?: () => void): THREE.Texture {
  optionalImage(path, (image) => {
    // La imagen nueva tiene otro tamaño: liberar la textura de GPU para que se vuelva a reservar.
    fallback.dispose();
    fallback.image = image;
    fallback.colorSpace = THREE.SRGBColorSpace;
    fallback.magFilter = THREE.NearestFilter;
    fallback.minFilter = THREE.NearestFilter;
    fallback.generateMipmaps = false;
    fallback.needsUpdate = true;
    onLoad?.();
  });
  return fallback;
}
