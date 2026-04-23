FROM docker.io/library/python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    JUPYTER_ROOT_DIR=/workspace/user-home \
    JUPYTER_BOOTSTRAP_DIR=/opt/platform/bootstrap-workspace

WORKDIR /workspace

ARG PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_TRUSTED_HOST=

COPY requirements.txt .
RUN if [ -n "${PIP_TRUSTED_HOST}" ]; then \
      pip install --no-cache-dir \
        --index-url "${PIP_INDEX_URL}" \
        --trusted-host "${PIP_TRUSTED_HOST}" \
        -r requirements.txt ; \
    else \
      pip install --no-cache-dir \
        --index-url "${PIP_INDEX_URL}" \
        -r requirements.txt ; \
    fi

COPY bootstrap/start-notebook.sh /usr/local/bin/start-notebook.sh
COPY work ${JUPYTER_BOOTSTRAP_DIR}

RUN chmod +x /usr/local/bin/start-notebook.sh \
  && mkdir -p "${JUPYTER_ROOT_DIR}"

EXPOSE 8888

CMD ["/usr/local/bin/start-notebook.sh"]
