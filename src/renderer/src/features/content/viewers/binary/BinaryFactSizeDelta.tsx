import { useBinaryFormatBytes } from './useBinaryFormatBytes';

export function BinaryFactSizeDelta({ bytes }: { bytes: number }): React.JSX.Element {
  const formatBytes = useBinaryFormatBytes();
  return <span>{formatBytes(bytes, true)}</span>;
}
