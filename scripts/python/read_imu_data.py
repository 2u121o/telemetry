#!/usr/bin/env python3
import argparse
import csv
from pathlib import Path
import matplotlib.pyplot as plt

def detect_delimiter(first_line: str) -> str:
    return ';' if first_line.count(';') > first_line.count(',') else ','

def load_columns(csv_path: Path):
    with csv_path.open('r', encoding='utf-8', newline='') as f:
        first = f.readline()
        delim = detect_delimiter(first)
    with csv_path.open('r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f, delimiter=delim)
        if not reader.fieldnames:
            raise ValueError("CSV senza intestazione: servono i nomi colonna.")
        # Normalizza header -> indice
        headers = [h.strip().lower() for h in reader.fieldnames]
        def find(col):
            base = col.lower().strip()
            try:
                idx = headers.index(base)
                return reader.fieldnames[idx]
            except ValueError:
                # fallback: accetta header che iniziano con il nome wanted
                for i, h in enumerate(headers):
                    if h.startswith(base + " "):
                        return reader.fieldnames[i]
                raise KeyError(f"Colonna '{col}' non trovata. Presenti: {reader.fieldnames}")

        key_ts = None
        for cand in ("timestamp","time","t"):
            try:
                key_ts = find(cand)
                break
            except Exception:
                continue
        if key_ts is None:
            raise KeyError("Colonna tempo non trovata (timestamp/time/t).")

        keys = {
            "t": key_ts,
            "ax": find("ax"),
            "ay": find("ay"),
            "az": find("az"),
            "wx": find("wx"),
            "wy": find("wy"),
            "wz": find("wz"),
        }

        T, AX, AY, AZ, WX, WY, WZ = [], [], [], [], [], [], []
        for row in reader:
            try:
                T.append(float(row[keys["t"]]))
                AX.append(float(row[keys["ax"]]))
                AY.append(float(row[keys["ay"]]))
                AZ.append(float(row[keys["az"]]))
                WX.append(float(row[keys["wx"]]))
                WY.append(float(row[keys["wy"]]))
                WZ.append(float(row[keys["wz"]]))
            except (TypeError, ValueError):
                # salta righe malformate
                continue

    return T, AX, AY, AZ, WX, WY, WZ

def main():
    ap = argparse.ArgumentParser(description="Plot ax, ay, az e wx, wy, wz vs timestamp da un CSV.")
    ap.add_argument("csvfile", type=Path, help="Percorso del file CSV con header (timestamp, ax, ay, az, wx, wy, wz, ...)")
    ap.add_argument("--outdir", type=Path, default=None, help="Cartella di output per i PNG; default: stessa del CSV")
    ap.add_argument("--show", action="store_true", help="Mostra i grafici a video oltre a salvarli")
    args = ap.parse_args()

    csv_path = args.csvfile
    if not csv_path.exists():
        raise SystemExit(f"File non trovato: {csv_path}")

    outdir = args.outdir or csv_path.parent
    outdir.mkdir(parents=True, exist_ok=True)

    T, AX, AY, AZ, WX, WY, WZ = load_columns(csv_path)

    # Plot accelerazioni
    plt.figure()
    plt.plot(T, AX, label="ax")
    plt.plot(T, AY, label="ay")
    plt.plot(T, AZ, label="az")
    plt.xlabel("timestamp")
    plt.ylabel("acceleration")
    plt.title("Accelerations vs time")
    plt.legend()
    acc_png = outdir / "accelerations.png"
    # plt.savefig(acc_png, dpi=150, bbox_inches="tight")

    # Plot velocità angolari
    plt.figure()
    plt.plot(T, WX, label="wx")
    plt.plot(T, WY, label="wy")
    plt.plot(T, WZ, label="wz")
    plt.xlabel("timestamp")
    plt.ylabel("angular velocity")
    plt.title("Angular velocities vs time")
    plt.legend()
    gyro_png = outdir / "angular_velocities.png"
    # plt.savefig(gyro_png, dpi=150, bbox_inches="tight")

    if args.show:
        plt.show()

    print(f"Saved: {acc_png}")
    print(f"Saved: {gyro_png}")

if __name__ == "__main__":
    main()