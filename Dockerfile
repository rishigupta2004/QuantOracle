FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV QUANTORACLE_DATA_DIR=/tmp/quantoracle-data
ENV QUANTORACLE_EOD_PREFIX=eod/nifty50
ENV QUANTORACLE_DISABLE_YFINANCE_INDIA=1

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

CMD ["sh", "-c", "streamlit run streamlit_app.py --server.port ${PORT:-7860} --server.address 0.0.0.0"]
