import { ImageResponse } from 'next/og';

import { SITE_DESCRIPTION, SITE_NAME } from '../lib/site-config';

export const alt = `${SITE_NAME} preview`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          background:
            'linear-gradient(135deg, #0f172a 0%, #111827 45%, #1d4ed8 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
          padding: '56px',
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            border: '1px solid rgba(248,250,252,0.18)',
            borderRadius: '28px',
            padding: '40px',
            background: 'rgba(15, 23, 42, 0.3)',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              opacity: 0.9,
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              maxWidth: '820px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 72,
                lineHeight: 1.05,
                fontWeight: 700,
              }}
            >
              Absensi QR dinamis untuk tim operasional yang bergerak cepat
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                lineHeight: 1.35,
                color: '#cbd5e1',
              }}
            >
              {SITE_DESCRIPTION}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
