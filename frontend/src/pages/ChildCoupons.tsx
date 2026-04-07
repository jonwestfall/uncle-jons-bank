import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../components/ToastProvider";
import { createApiClient } from "../api/client";
import { listCouponRedemptions, redeemCoupon, type CouponRedemption } from "../api/coupons";
import { mapApiErrorMessage, toastApiError } from "../utils/apiError";

interface DetectedCode {
  rawValue: string;
}

interface BarcodeDetector {
  detect(source: CanvasImageSource): Promise<DetectedCode[]>;
}

interface BDConstructor {
  new (options: { formats: string[] }): BarcodeDetector;
}

interface Props {
  token: string;
  apiUrl: string;
  currencySymbol: string;
}

export default function ChildCoupons({ token, apiUrl, currencySymbol }: Props) {
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("code") || "");
  const [history, setHistory] = useState<CouponRedemption[]>([]);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { showToast } = useToast();
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  );

  const fetchHistory = useCallback(async () => {
    try {
      setHistory(await listCouponRedemptions(client));
    } catch (error) {
      toastApiError(showToast, error, "Failed to load coupon history");
    }
  }, [client, showToast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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
    try {
      const data = await redeemCoupon(client, code);
      showToast(`Coupon redeemed for ${currencySymbol}${data.coupon.amount.toFixed(2)}`);
      setCode("");
      fetchHistory();
    } catch (error) {
      showToast(mapApiErrorMessage(error, "Invalid coupon"));
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
