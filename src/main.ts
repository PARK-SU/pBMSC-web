import { mount } from 'svelte';
import Root from './ui/Root.svelte';
import './ui/app.css';
import { compactGxHeight, isDesktopWidth } from './ui/layout/media.ts';
import { ViewerController } from './ui/viewer/controller.ts';
import { watchPixelRatio } from './ui/viewer/pixel-ratio.ts';
import { startPwa } from './ui/pwa/state.ts';

const root = document.getElementById('root');
if (!root) throw new Error('#root element is missing');

const controller = new ViewerController(isDesktopWidth() ? {} : { gxHeight: compactGxHeight });
watchPixelRatio((pixelRatio) => controller.setPixelRatio(pixelRatio));
void controller.start();
startPwa();
mount(Root, { target: root, props: { controller } });
