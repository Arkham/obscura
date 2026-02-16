declare module 'dcraw' {
  interface DcrawOptions {
    verbose?: boolean;
    identify?: boolean;
    toStandardOutput?: boolean;
    extractThumbnail?: boolean;
    useCameraWhiteBalance?: boolean;
    useAverageWhiteBalance?: boolean;
    useEmbeddedColorMatrix?: boolean;
    useDocumentMode?: boolean;
    useRawMode?: boolean;
    setNoAutoBrightnessMode?: boolean;
    setHalfSizeMode?: boolean;
    use16BitMode?: boolean;
    use16BitLinearMode?: boolean;
    exportAsTiff?: boolean;
    setInterpolationQuality?: string;
    setHighlightMode?: string;
    setColorSpace?: string;
    setBrightnessLevel?: string;
    setCustomGammaCurve?: string;
    [key: string]: boolean | string | undefined;
  }

  function dcraw(buffer: Uint8Array, options?: DcrawOptions): Uint8Array | string;
  export default dcraw;
}
