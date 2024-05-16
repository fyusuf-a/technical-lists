export class CustomSet<T> {
  set: Set<T>;
  equalityFunction: (a: T, b: T) => boolean;

  constructor(equalityFunction: (a: T, b: T) => boolean) {
    this.set = new Set();
    this.equalityFunction = equalityFunction;
  }

  _findElement(element: T) {
    for (let item of this.set) {
      if (this.equalityFunction(item, element)) {
        return item;
      }
    }
    return null;
  }

  add(element: T) {
    const existingElement = this._findElement(element);
    if (!existingElement) {
      this.set.add(element);
    }
  }

  has(element: T) {
    return this._findElement(element) !== null;
  }

  delete(element: T) {
    const existingElement = this._findElement(element);
    if (existingElement) {
      this.set.delete(existingElement);
      return true;
    }
    return false;
  }

  get size() {
    return this.set.size;
  }

  [Symbol.iterator]() {
    return this.set[Symbol.iterator]();
  }

  forEach(callback: (value: T) => void) {
    this.set.forEach(callback);
  }

  values() {
    return this.set.values();
  }
}
