"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

type ShareProductProps = { productId: string; slug?: string; name: string };

export default function ShareProduct({
    productId,
    slug,
    name,
}: ShareProductProps) {
    const path = `/products/${slug ?? productId}`;
    const [url, setUrl] = useState(path);
    const [qrCode, setQrCode] = useState("");
    const [status, setStatus] = useState("");

    useEffect(() => {
        const absoluteUrl = `${window.location.origin}${path}`;
        let active = true;
        void Promise.resolve().then(() => {
            if (active) setUrl(absoluteUrl);
        });
        void QRCode.toDataURL(absoluteUrl)
            .then((dataUrl) => {
                if (active) {
                    setQrCode(dataUrl);
                }
            })
            .catch(() => {
                if (active) setQrCode("");
            });
        return () => {
            active = false;
        };
    }, [path]);

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(url);
            setStatus("Link copied");
        } catch {
            setStatus("Couldn't copy the link. Select and copy the URL above.");
        }
    }

    return (
        <section className="mt-4" aria-labelledby="share-product-heading">
            <h2 className="text-lg" id="share-product-heading">
                Share this product
            </h2>
            <p className="break-all">
                <a href={url}>{url}</a>
            </p>
            <button type="button" onClick={() => void copyLink()}>
                Copy link
            </button>
            {status && <output aria-live="polite">{status}</output>}
            {qrCode && (
                <Image
                    src={qrCode}
                    alt={`QR code for ${name}`}
                    width={180}
                    height={180}
                    unoptimized
                />
            )}
        </section>
    );
}
