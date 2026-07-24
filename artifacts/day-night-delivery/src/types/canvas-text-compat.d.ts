export {};

declare global {
  interface CanvasRenderingContext2D {
    /**
     * Canvas coerces nullable display values to text at runtime. This overload keeps
     * strict TypeScript checks aligned with that browser behavior for PDF renderers.
     */
    fillText(text: string | null | undefined, x: number, y: number, maxWidth?: number): void;
  }
}
