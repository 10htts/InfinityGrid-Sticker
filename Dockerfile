FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser

COPY --chown=appuser:appuser index.html server.py /app/
COPY --chown=appuser:appuser Icons_SVG /app/Icons_SVG
COPY --chown=appuser:appuser bases /app/bases

USER appuser

EXPOSE 3000

CMD ["python", "server.py"]
