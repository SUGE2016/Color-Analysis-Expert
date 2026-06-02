FROM python:3.11-slim-bookworm

ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG APT_MIRROR=mirrors.aliyun.com

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=5

RUN sed -i "s/deb.debian.org/${APT_MIRROR}/g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i "s/deb.debian.org/${APT_MIRROR}/g" /etc/apt/sources.list

WORKDIR /app

COPY requirements.docker.txt .
RUN pip install --no-cache-dir -r requirements.docker.txt

COPY algo ./algo
COPY app_http.py .

EXPOSE 5000
CMD ["python", "app_http.py"]
