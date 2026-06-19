import { syncMobilePartsDrawer } from './app-ui.js';

const WIDE_DESKTOP_MQ = '(min-width: 1100px)';

function usesViewportScaling() {
  return !window.matchMedia(WIDE_DESKTOP_MQ).matches;
}

export function initReactorViewport(viewportEl, canvasEl, mainEl) {  if (!viewportEl || !canvasEl) return null;

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let panStart = null;
  let pinchStart = null;

  const minScale = 0.5;
  const maxScale = 2;

  function applyTransform() {
    canvasEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    canvasEl.style.transformOrigin = '0 0';
  }

  function availableViewportHeight() {
    const maxHeight = parseFloat(getComputedStyle(viewportEl).maxHeight);
    if (Number.isFinite(maxHeight) && maxHeight > 0) {
      return maxHeight;
    }
    return viewportEl.clientHeight;
  }

  function fitMobileScale() {
    if (!usesViewportScaling()) return;

    const contentW = canvasEl.offsetWidth;
    const contentH = canvasEl.offsetHeight;
    const vpW = viewportEl.clientWidth;
    const vpH = availableViewportHeight();

    if (!contentW || !contentH || !vpW || !vpH) return;

    const scaleW = vpW / contentW;
    const scaleH = vpH / contentH;
    scale = Math.min(1, scaleW, scaleH);
  }

  function clampTranslate() {
    const vpW = viewportEl.clientWidth;
    const vpH = viewportEl.clientHeight;
    const contentW = canvasEl.offsetWidth * scale;
    const contentH = canvasEl.offsetHeight * scale;

    if (contentW <= vpW) {
      translateX = (vpW - contentW) / 2;
    } else {
      const minX = vpW - contentW;
      translateX = Math.min(0, Math.max(minX, translateX));
    }

    if (contentH <= vpH) {
      translateY = (vpH - contentH) / 2;
    } else {
      const minY = vpH - contentH;
      translateY = Math.min(0, Math.max(minY, translateY));
    }

    applyTransform();
  }

  function fitViewportHeight() {
    if (!usesViewportScaling()) {
      viewportEl.style.height = '';
      return;
    }

    const contentH = canvasEl.offsetHeight * scale;
    viewportEl.style.height = contentH ? `${Math.ceil(contentH)}px` : '';
  }

  function refit() {
    fitMobileScale();
    fitViewportHeight();
    clampTranslate();
    syncMobilePartsDrawer(mainEl);
    requestAnimationFrame(() => syncMobilePartsDrawer(mainEl));
  }

  function touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function touchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }

  function panAllowed() {
    return !(
      mainEl.classList.contains('macro_mode') &&
      mainEl.classList.contains('part_active')
    );
  }

  function onTouchStart(e) {
    if (!usesViewportScaling()) return;

    if (e.touches.length === 2) {
      panStart = null;
      const dist = touchDistance(e.touches);
      const center = touchCenter(e.touches);
      const rect = viewportEl.getBoundingClientRect();
      pinchStart = {
        dist,
        scale,
        translateX,
        translateY,
        focalX: center.x - rect.left,
        focalY: center.y - rect.top
      };
      e.preventDefault();
    } else if (e.touches.length === 1 && panAllowed()) {
      panStart = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        translateX,
        translateY
      };
    }
  }

  function onTouchMove(e) {
    if (!usesViewportScaling()) return;

    if (e.touches.length === 2 && pinchStart) {
      const dist = touchDistance(e.touches);
      const ratio = dist / pinchStart.dist;
      const newScale = Math.min(maxScale, Math.max(minScale, pinchStart.scale * ratio));

      translateX = pinchStart.focalX - (pinchStart.focalX - pinchStart.translateX) * (newScale / pinchStart.scale);
      translateY = pinchStart.focalY - (pinchStart.focalY - pinchStart.translateY) * (newScale / pinchStart.scale);
      scale = newScale;

      applyTransform();
      clampTranslate();
      e.preventDefault();
    } else if (e.touches.length === 1 && panStart && panAllowed()) {
      translateX = panStart.translateX + (e.touches[0].clientX - panStart.x);
      translateY = panStart.translateY + (e.touches[0].clientY - panStart.y);
      applyTransform();
      clampTranslate();
      e.preventDefault();
    }
  }

  function onTouchEnd() {
    panStart = null;
    pinchStart = null;
  }

  viewportEl.addEventListener('touchstart', onTouchStart, { passive: false });
  viewportEl.addEventListener('touchmove', onTouchMove, { passive: false });
  viewportEl.addEventListener('touchend', onTouchEnd);
  viewportEl.addEventListener('touchcancel', onTouchEnd);

  window.addEventListener('resize', refit);

  refit();

  return {
    reset() {
      scale = 1;
      translateX = 0;
      translateY = 0;
      refit();
    },
    refit,
    clampTranslate
  };
}
