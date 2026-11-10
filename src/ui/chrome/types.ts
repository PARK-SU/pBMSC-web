import type { ViewerChrome, ViewerController } from '../viewer/controller.ts';
import type { UiText } from '../viewer/text.ts';

export interface ChromeProps {
  readonly controller: ViewerController;
  readonly chrome: ViewerChrome;
  readonly text: UiText;
}

export interface LayoutProps extends ChromeProps {
  readonly onOpen: () => void;
}
