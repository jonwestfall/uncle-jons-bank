import { useEffect, useRef, useState } from "react";
import { useToast } from "../components/ToastProvider";

interface CouponInfo {
  id: number;
  redeemed_at: string;
  coupon: {
    code: string;
    amount: number;
    memo?: string | null;
  };
}

interface Props {
  token: string;
  apiUrl: string;
  currencySymbol: string;
}

export default function ChildCoupons({ token, apiUrl, currencySymbol }: Props) {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("code") || "");
  const [history, setHistory] = useState<CouponInfo[]>([]);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    const resp = await fetch(`${apiUrl}/coupons/redemptions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      setHistory(await resp.json());
    }
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let interval: number | null = null;
    async function startScan() {
      if (!("BarcodeDetector" in window)) {
        showToast("QR scanning not supported");
        setScanning(false);
        return;
      }
      try {
        interface BDConstructor {
          new (options: { formats: string[] }): BarcodeDetector;
        }
        const Detector = (window as unknown as { BarcodeDetector: BDConstructor }).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        interval = window.setInterval(async () => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const codes = await detector.detect(canvas);
          if (codes.length > 0) {
            setCode(codes[0].rawValue);
            setScanning(false);
          }
        }, 500);
      } catch {
        showToast("Camera access denied");
        setScanning(false);
      }
    }
    if (scanning) {
      startScan();
    }
    return () => {
      if (interval) clearInterval(interval);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, showToast]);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const resp = await fetch(`${apiUrl}/coupons/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });
    if (resp.ok) {
      const data = await resp.json();
      showToast(`Coupon redeemed for ${currencySymbol}${data.coupon.amount.toFixed(2)}`);
      setCode("");
      fetchHistory();
    } else {
        let msg = "Invalid coupon";
        try {
          const err = await resp.json();
          if (err.detail) msg = err.detail;
        } catch {
          /* ignore */
        }
        showToast(msg);
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2>Redeem Coupon</h2>
      <form onSubmit={handleRedeem} className="space-x-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
        />
        <button type="submit">Redeem</button>
        <button type="button" onClick={() => setScanning(true)}>
          Scan QR
        </button>
      </form>
      {scanning && <video ref={videoRef} className="mt-2 w-full" />}
      <h3 className="mt-6">Redeemed Coupons</h3>
      {history.length === 0 ? (
        <p>No coupons redeemed yet.</p>
      ) : (
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th>Code</th>
              <th>Amount</th>
              <th>Memo</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.coupon.code}</td>
                <td>
                  {currencySymbol}
                  {h.coupon.amount.toFixed(2)}
                </td>
                <td>{h.coupon.memo}</td>
                <td>{new Date(h.redeemed_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
