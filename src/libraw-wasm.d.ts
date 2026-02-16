declare module 'libraw-wasm' {
  interface LibRawSettings {
    bright?: number;
    threshold?: number;
    halfSize?: boolean;
    highlight?: number;
    useAutoWb?: boolean;
    useCameraWb?: boolean;
    useCameraMatrix?: number;
    outputColor?: number;
    outputBps?: number;
    userQual?: number;
    noAutoBright?: boolean;
    noAutoScale?: boolean;
    noInterpolation?: boolean;
    gamm?: [number, number] | null;
    userMul?: [number, number, number, number] | null;
    expCorrec?: boolean;
    expShift?: number;
    expPreser?: number;
    cropbox?: [number, number, number, number] | null;
  }

  interface LibRawMetadata {
    make: string;
    model: string;
    iso_speed: number;
    shutter: number;
    aperture: number;
    focal_len: number;
    width: number;
    height: number;
    raw_width: number;
    raw_height: number;
    flip: number;
    colors: number;
    timestamp: Date;
    desc: string;
    artist: string;
    thumb_format: string;
    thumb_width: number;
    thumb_height: number;
    cam_mul?: number[];
  }

  class LibRaw {
    constructor();
    open(data: Uint8Array, settings?: LibRawSettings): Promise<void>;
    metadata(fullOutput?: boolean): Promise<LibRawMetadata>;
    imageData(): Promise<Uint8Array | Uint16Array>;
  }

  export default LibRaw;
}
