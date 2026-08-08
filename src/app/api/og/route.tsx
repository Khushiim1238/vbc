import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Dynamic values
    const name = searchParams.get('name') || 'Karigar';
    const points = searchParams.get('points') || '0';
    const total = searchParams.get('total') || '0';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a', // slate-900
            backgroundImage: 'linear-gradient(to bottom right, #0f172a, #1e1b4b)',
            fontFamily: '"Inter", sans-serif',
            color: 'white',
            padding: '40px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px' }}>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 'bold',
                color: '#38bdf8', // sky-400
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              Vardhaman Group
            </div>
          </div>

          {/* Main Card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '24px',
              padding: '60px',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ fontSize: '36px', color: '#cbd5e1', marginBottom: '20px' }}>
              Congratulations, <span style={{ color: 'white', fontWeight: 'bold' }}>{name}</span>!
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '10px' }}>
              <span style={{ fontSize: '100px', fontWeight: '900', color: '#facc15' }}>+{points}</span>
              <span style={{ fontSize: '32px', color: '#fef08a', marginLeft: '12px' }}>Points Earned</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginTop: '30px',
                padding: '16px 32px',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                borderRadius: '999px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              <span style={{ fontSize: '28px', color: '#bae6fd' }}>New Total Balance:</span>
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', marginLeft: '12px' }}>
                {total} ⭐
              </span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ position: 'absolute', bottom: '40px', fontSize: '24px', color: '#64748b' }}>
            MB Builder Perfect Plus Cement Rewards
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
