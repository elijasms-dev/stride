'use client';

import { useEffect, useRef, useState } from 'react';

export type SessionMood = 'easy' | 'quality' | 'long' | 'rest';

function EasyLandscape() {
  return (
    <>
      <g className="session-atmosphere__distant">
        <circle cx="566" cy="110" r="39" />
        <path d="M521 115c19-5 44-4 66 0m-59 8c15-3 31-3 48-1" />
      </g>
      <g className="session-atmosphere__drift">
        <path
          className="session-atmosphere__wash"
          d="M96 340c89-7 139-102 224-93s129 66 202 15 123-45 208-69v227H96Z"
        />
        <path
          className="session-atmosphere__contour"
          d="M96 340c89-7 139-102 224-93s129 66 202 15 123-45 208-69"
        />
        <path
          className="session-atmosphere__pencil"
          d="M213 291c49-40 91-46 133-26s81 42 126 28"
        />
      </g>
      <path
        className="session-atmosphere__wash session-atmosphere__wash-near"
        d="M205 420c44-38 81-27 132-53s92-56 147-38 146 47 247-28v119Z"
      />
      <path
        className="session-atmosphere__contour session-atmosphere__near"
        d="M205 420c44-38 81-27 132-53s92-56 147-38 146 47 247-28"
      />
      <g className="session-atmosphere__botanical session-atmosphere__sway">
        <path d="M617 338c-6-33-7-73 6-116m-7 70c-19-2-28-12-29-25 19 0 28 11 29 25Zm1-26c19-4 29-16 31-31-19 4-29 15-31 31Zm3-24c-13-4-20-14-18-25 14 5 20 14 18 25Z" />
        <path
          className="session-atmosphere__pencil"
          d="m594 275 15 11m13-28 16-15"
        />
      </g>
      <g className="session-atmosphere__botanical session-atmosphere__sway-delayed">
        <path d="M513 378c1-16 4-33 12-48m-7 33c-13-2-19-9-19-18 13 2 20 9 19 18Zm3-15c13-3 21-11 23-22-14 3-21 10-23 22Z" />
      </g>
      <g className="session-atmosphere__hatch">
        <path d="m664 350-18 19m31-24-18 19m30-24-18 19m30-24-18 19m30-25-18 19" />
      </g>
    </>
  );
}

function QualityLines() {
  return (
    <>
      <path
        className="session-atmosphere__wash"
        d="m321 420 204-251c19-23 40-23 60-2l145 151v102Z"
      />
      <g className="session-atmosphere__track">
        <path d="m245 430 277-289c21-22 45-21 66 1l151 161" />
        <path d="m276 430 256-266c16-16 34-16 49 1l158 167" />
        <path d="m309 431 233-241c10-10 21-10 31 1l166 175" />
        <path className="session-atmosphere__pencil" d="m543 153 12-9 12 2" />
      </g>
      <g className="session-atmosphere__velocity">
        <path
          className="session-atmosphere__near"
          d="m452 117 34-37m31 7 16-17m84 47 25-26m-55 242 45-49m-68 97 22-24"
        />
        <path
          className="session-atmosphere__pencil"
          d="m447 111 33-36m140 33 13-14m-59 278 9-10"
        />
      </g>
      <g className="session-atmosphere__hatch">
        <path d="m634 201 28-2m-19 11 28-2m-19 11 28-2m-19 11 28-2m-19 11 28-2" />
      </g>
      <path
        className="session-atmosphere__distant"
        d="m386 270 15-16m-4 23 15-16m-4 23 15-16"
      />
    </>
  );
}

function LongLandscape() {
  return (
    <>
      <g className="session-atmosphere__distant">
        <circle cx="574" cy="114" r="43" />
        <path d="M488 173h119m14 0h48m-126 9h89" />
      </g>
      <g className="session-atmosphere__far-ridge">
        <path
          className="session-atmosphere__wash"
          d="m183 286 92-74 47 27 71-74 100 80 49-40 42 23 48-75 100 69v198H183Z"
        />
        <path
          className="session-atmosphere__contour"
          d="m183 286 92-74 47 27 71-74 100 80 49-40 42 23 48-75 100 69"
        />
        <path
          className="session-atmosphere__pencil"
          d="m355 207 38-42 24 19m191 7 24-38 16 11"
        />
      </g>
      <g className="session-atmosphere__near-ridge">
        <path
          className="session-atmosphere__wash session-atmosphere__wash-near"
          d="m178 394 121-89 62 21 63-60 99 50 73-64 134 67v101H178Z"
        />
        <path
          className="session-atmosphere__contour session-atmosphere__near"
          d="m178 394 121-89 62 21 63-60 99 50 73-64 134 67"
        />
        <path
          className="session-atmosphere__trail"
          d="M549 277c-24 27-3 39 20 56s-13 40-70 48-78 21-93 49m143-153c-13 24 12 32 37 51s-3 49-66 62-68 23-72 40"
        />
        <path
          className="session-atmosphere__hatch"
          d="m323 347-13 14m25-12-13 14m25-12-13 14m25-12-13 14"
        />
      </g>
    </>
  );
}

function RestLandscape() {
  return (
    <>
      <g className="session-atmosphere__moon">
        <path
          className="session-atmosphere__wash session-atmosphere__moon-fill"
          d="M595 68c-26 1-47 24-45 51s26 47 53 43c14-2 27-10 34-22-20 8-43 2-55-16s-9-40 5-55Z"
        />
        <path
          className="session-atmosphere__contour"
          d="M595 68c-26 1-47 24-45 51s26 47 53 43c14-2 27-10 34-22-20 8-43 2-55-16s-9-40 5-55"
        />
        <path
          className="session-atmosphere__pencil"
          d="M560 123c4 17 20 29 38 30"
        />
      </g>
      <g className="session-atmosphere__stars">
        <path d="M443 100v10m-5-5h10m46 86v8m-4-4h8m154-137v10m-5-5h10m-5 153v8m-4-4h8m-109 16v6m-3-3h6" />
        <circle cx="513" cy="67" r="1.3" />
        <circle cx="681" cy="149" r="1.5" />
        <circle cx="413" cy="215" r="1" />
        <circle cx="606" cy="201" r="1" />
      </g>
      <path
        className="session-atmosphere__wash"
        d="M157 369c92 15 129-39 204-22s134-42 208-20 106-13 161-23v116H157Z"
      />
      <path
        className="session-atmosphere__contour"
        d="M157 369c92 15 129-39 204-22s134-42 208-20 106-13 161-23"
      />
      <path
        className="session-atmosphere__distant"
        d="M423 297c28-9 56-5 75-7s27-12 53-11m-101 29c17-4 33-2 51-5"
      />
      <path
        className="session-atmosphere__near"
        d="M301 419c57-35 119-16 168-32s101-11 149-4 72 1 114-11"
      />
    </>
  );
}

/** A decorative journal sketch, never a chart, route map or representation of workout data. */
export function SessionAtmosphere({
  mood,
  motion = true,
}: {
  mood: SessionMood;
  motion?: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = element.current;
    if (!node || !motion) return;
    let inView = false;
    const update = () =>
      setVisible(inView && document.visibilityState !== 'hidden');
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry.isIntersecting;
            update();
          });
    if (observer) observer.observe(node);
    else inView = true;
    const frame = requestAnimationFrame(update);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', update);
    };
  }, [motion]);

  return (
    <div
      ref={element}
      className="session-atmosphere"
      data-mood={mood}
      data-motion={motion}
      data-visible={visible}
      aria-hidden="true"
    >
      <svg
        className="session-atmosphere__drawing"
        viewBox="0 0 700 420"
        preserveAspectRatio="xMaxYMid slice"
        fill="none"
        focusable="false"
        aria-hidden="true"
      >
        {mood === 'easy' ? (
          <EasyLandscape />
        ) : mood === 'quality' ? (
          <QualityLines />
        ) : mood === 'long' ? (
          <LongLandscape />
        ) : (
          <RestLandscape />
        )}
      </svg>
    </div>
  );
}
