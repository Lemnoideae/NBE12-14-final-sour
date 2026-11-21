import { useLayoutEffect, useRef, useState } from 'react';
import type { SchoolId } from '../data/schoolIds';
import type { SchoolView } from '../data/schoolDirectory';
import { MAP_DESIGN_FRAME_PX, type Point } from '../data/schoolMapLayout';
import { mapPinAnchor, placeWorkspaceMapPins, type MapPinRect } from '../utils/workspaceMapPins';
import { soundManager } from '../utils/sound';
import { SchoolBadge } from './MapParts';

export interface WorkspacePin {
  school: SchoolView;
  point: Point;
}

const boxCenter = (box: MapPinRect): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
const position = (box: MapPinRect) => ({ left: box.x, top: box.y });
const platePosition = (plate?: MapPinRect, logo?: MapPinRect) => plate && logo
  ? { left: plate.x - logo.x, top: plate.y - logo.y }
  : { visibility: 'hidden' as const };
const pinCenter = (point: Point) => ({
  left: `${point.x / MAP_DESIGN_FRAME_PX.width * 100}%`,
  top: `${point.y / MAP_DESIGN_FRAME_PX.height * 100}%`,
  translate: '-50% -50%',
});

/** Fit visible controls in CSS pixels without changing the image transform or the underlying school points. */
export function WorkspaceMapPins({ pins, selectedId, onSelect }: {
  pins: readonly WorkspacePin[];
  selectedId?: SchoolId;
  onSelect: (id: SchoolId) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<ReturnType<typeof placeWorkspaceMapPins>>();
  const [focused, setFocused] = useState<SchoolId>();
  const [hovered, setHovered] = useState<SchoolId>();
  const [dismissed, setDismissed] = useState(false);

  useLayoutEffect(() => {
    const layer = ref.current;
    const area = layer?.parentElement;
    if (!layer || !area) return;
    const controls = [...layer.querySelectorAll<HTMLButtonElement>('button[data-school-id]')];
    const labels = [...layer.querySelectorAll<HTMLElement>('.game-map-pin-name')];
    const ranks = [...layer.querySelectorAll<HTMLElement>('.game-map-pin-rank')];
    const obstacles = [...area.querySelectorAll<HTMLElement>('[data-cluster-region], .game-map-own-tag')];
    const caption = layer.querySelector<HTMLElement>('.game-map-pin-caption');
    const byId = (nodes: HTMLElement[]) => new Map(nodes.map(node => [Number(node.dataset.pinId), node]));
    const labelsById = byId(labels);
    const ranksById = byId(ranks);

    const fit = () => {
      const { width, height, left, top } = layer.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      const size = { width, height };
      const sizeOf = (node: HTMLElement) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      };
      const avoid = obstacles.map(node => {
        const rect = node.getBoundingClientRect();
        return { x: rect.left - left, y: rect.top - top, width: rect.width, height: rect.height };
      });
      const geometries = pins.flatMap(({ school, point }, i) => {
        const rank = ranksById.get(school.id);
        const label = labelsById.get(school.id);
        if (!label || !controls[i]) return [];
        return [{ id: school.id, anchor: mapPinAnchor(point, size), logo: sizeOf(controls[i]),
          label: sizeOf(label), rank: rank && sizeOf(rank), ownSchool: school.isMySchool, selected: school.id === selectedId }];
      });
      setPlaced(placeWorkspaceMapPins(size, geometries, avoid, (caption?.offsetHeight ?? 24) + 8));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    [layer, ...controls, ...labels, ...ranks, ...obstacles].forEach(node => observer.observe(node));
    if (caption) observer.observe(caption);
    return () => observer.disconnect();
  }, [pins, selectedId]);

  const activeId = focused ?? hovered;
  const revealed = pins.find(({ school }) => school.id === activeId)?.school;
  return <div ref={ref} className="game-map-pins" data-map-pins>
    {pins.map(({ school, point }) => {
      const layout = placed?.get(school.id);
      const logoPosition = layout ? position(layout.logo) : pinCenter(point);
      return <button key={school.id} type="button" data-school-id={school.id} data-top-rank={school.isTop3 ? school.rank : undefined}
          data-own-school={school.isMySchool || undefined} data-no-touch44
          aria-label={`${school.name} 전국 ${school.rank}위`} aria-pressed={selectedId === school.id}
          className="game-map-pin" style={logoPosition}
          onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) { setFocused(school.id); setDismissed(false); } }}
          onBlur={() => setFocused(undefined)}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') { setHovered(school.id); setDismissed(false); } }}
          onPointerLeave={() => setHovered(undefined)}
          onKeyDown={(event) => { if (event.key === 'Escape') setDismissed(true); }}
          onClick={() => { soundManager.playTabSound(); onSelect(school.id); }}>
          <SchoolBadge school={school} className="game-map-pin-logo" />
          {school.isTop3 && <span className="game-map-pin-medal" aria-hidden="true">{school.rank}</span>}
          {school.isTop3 && <span className="game-map-pin-rank" data-pin-id={school.id} style={platePosition(layout?.rank, layout?.logo)}>
            <strong>{school.rank}위</strong>
            <span className="font-mono">{school.score.toLocaleString('ko-KR')}</span>
          </span>}
          <span className="game-map-pin-name" data-pin-id={school.id} data-priority={school.isTop3 || school.isMySchool || selectedId === school.id}
            style={platePosition(layout?.label, layout?.logo)}>{school.shortName}</span>
        </button>;
    })}
    <svg className="game-map-pin-lines" aria-hidden="true">
      {pins.map(({ school }) => {
        const layout = placed?.get(school.id);
        if (!layout) return null;
        const logo = boxCenter(layout.logo);
        const endpoints = [layout.label, layout.rank].flatMap(box => box ? [boxCenter(box)] : []);
        const { anchor } = layout;
        const showAnchor = (school.id === activeId || school.id === selectedId)
          && Math.hypot(anchor.x - logo.x, anchor.y - logo.y) > layout.logo.width / 2;
        return <g key={school.id}>
          {endpoints.map((end) => <line key={`${end.x},${end.y}`} x1={logo.x} y1={logo.y} x2={end.x} y2={end.y} />)}
          {showAnchor && <g>
            <line x1={logo.x} y1={logo.y} x2={anchor.x} y2={anchor.y} strokeDasharray="3 2" />
            <circle cx={anchor.x} cy={anchor.y} r="2" fill="#facc15" />
          </g>}
        </g>;
      })}
    </svg>
    <div className="game-map-pin-caption" data-revealed={!!revealed && !dismissed} aria-hidden="true">{revealed?.name}</div>
  </div>;
}
