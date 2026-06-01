export class ExponentialMovingAverage {
  private _value: number;
  private _sampleCount = 0;

  constructor(
    private readonly alpha: number,
    initial: number,
  ) {
    this._value = initial;
  }

  update(sample: number): number {
    this._value = this.alpha * sample + (1 - this.alpha) * this._value;
    this._sampleCount += 1;
    return this._value;
  }

  get value(): number {
    return this._value;
  }

  get sampleCount(): number {
    return this._sampleCount;
  }

  reset(newInitial: number): void {
    this._value = newInitial;
    this._sampleCount = 0;
  }
}
