import { Lightbox } from '../components/Lightbox';
import { useUiDispatch } from './UiContext';
import { useLightbox } from './hooks';

export function LightboxHost(): React.JSX.Element | null {
  const content = useLightbox();
  const dispatch = useUiDispatch();
  if (!content) return null;
  return <Lightbox content={content} onClose={() => dispatch({ type: 'lightbox/close' })} />;
}
