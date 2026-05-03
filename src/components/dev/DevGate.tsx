'use client';

import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';

import { approvedTagFor, CURRENT_CANDIDATE_TAG, CURRENT_MILESTONE } from '@/lib/buildInfo';
import type { DevChecklist } from '@/game/dev/checklists';

type DevInfoResponse = {
  localIp: string | null;
  port: string;
  candidateTag: string;
  milestone: string;
};

type DevGateProps = {
  checklist: DevChecklist;
};

export function DevGate({ checklist }: DevGateProps) {
  const [devInfo, setDevInfo] = useState<DevInfoResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    let ignore = false;

    async function loadDevInfo() {
      const response = await fetch('/api/dev-info', { cache: 'no-store' });
      const info = (await response.json()) as DevInfoResponse;
      if (!ignore) {
        setDevInfo(info);
      }
    }

    loadDevInfo().catch(() => {
      if (!ignore) {
        setDevInfo({
          localIp: null,
          port: window.location.port || '3000',
          candidateTag: CURRENT_CANDIDATE_TAG,
          milestone: CURRENT_MILESTONE
        });
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  const gameUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    const host = devInfo?.localIp ?? window.location.hostname;
    const port = devInfo?.port ? `:${devInfo.port}` : '';
    return `${window.location.protocol}//${host}${port}/game`;
  }, [devInfo]);

  const candidateTag = devInfo?.candidateTag ?? CURRENT_CANDIDATE_TAG;
  const approvedTag = approvedTagFor(candidateTag);
  const approvedCommand = `git tag ${approvedTag}`;

  useEffect(() => {
    if (!gameUrl) {
      return;
    }

    QRCode.toDataURL(gameUrl, {
      margin: 1,
      width: 240,
      color: {
        dark: '#1a1a1a',
        light: '#f5f0df'
      }
    }).then(setQrDataUrl).catch(() => setQrDataUrl(''));
  }, [gameUrl]);

  async function copyApprovedCommand() {
    try {
      await navigator.clipboard.writeText(approvedCommand);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <main className="dev-page">
      <section className="dev-panel">
        <p className="eyebrow">Reel Mobile</p>
        <h1>Dev Gate</h1>
        <dl className="dev-facts">
          <div>
            <dt>Current candidate</dt>
            <dd><code>{candidateTag}</code></dd>
          </div>
          <div>
            <dt>Milestone</dt>
            <dd>{checklist.title}</dd>
          </div>
          <div>
            <dt>Local game URL</dt>
            <dd><code>{gameUrl || 'Resolving local address...'}</code></dd>
          </div>
        </dl>

        <div className="qr-wrap" aria-label="QR code for local game URL">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={gameUrl} width={240} height={240} />
          ) : (
            <span>QR loading</span>
          )}
        </div>

        <button className="primary-action" type="button" onClick={copyApprovedCommand}>
          Copy approval tag command
        </button>
        <p className="copy-hint">
          <code>{approvedCommand}</code>
          {copyState === 'copied' ? ' copied.' : null}
          {copyState === 'failed' ? ' could not be copied.' : null}
        </p>
      </section>

      <section className="dev-panel">
        <h2>Manual Checklist</h2>
        <ol className="manual-checklist">
          {checklist.items.map((item) => (
            <li key={item.id}>
              <label>
                <input type="checkbox" />
                <span>{item.text}</span>
              </label>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
