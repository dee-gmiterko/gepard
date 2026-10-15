import { useIntl } from 'react-intl';
import { byteUnit } from '../../../../helpers/binary';

export function useBinaryFormatBytes(): (bytes: number, signed?: boolean) => string {
  const intl = useIntl();
  return (bytes, signed = false) => {
    const { value, unit } = byteUnit(bytes);
    return intl.formatNumber(value, {
      style: 'unit',
      unit,
      unitDisplay: unit === 'byte' ? 'long' : 'short',
      maximumFractionDigits: 1,
      signDisplay: signed ? 'exceptZero' : 'auto',
    });
  };
}
