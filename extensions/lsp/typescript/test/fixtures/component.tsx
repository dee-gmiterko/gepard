import { useState } from 'react';
import { Store } from './module';

export interface ButtonProps {
  label: string;
  onClick(): void;
}

export function Button({ label, onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}

export const Counter = () => {
  const [count, setCount] = useState(0);
  const increment = () => setCount((c) => c + 1);
  return (
    <div className="counter">
      <Button label={String(count)} onClick={increment} />
    </div>
  );
};

export default class App {
  private store = new Store();

  render() {
    return <Counter />;
  }
}
