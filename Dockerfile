FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libxrender1 \
        libxext6 \
        libsm6 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY --chown=appuser:appuser index.html server.py favicon.svg AppIcon.png /app/
COPY --chown=appuser:appuser assets /app/assets
COPY --chown=appuser:appuser Icons_SVG /app/Icons_SVG
COPY --chown=appuser:appuser bases /app/bases

USER appuser

EXPOSE 3000

CMD ["python", "server.py"]
