# jupyter

`applications/jupyter` is the source image for user Jupyter pods.

Default image target in this repo:

```bash
192.168.56.32/app/jupyter:latest
```

Build locally:

```bash
docker build -t 192.168.56.32/app/jupyter:latest /home/ubuntu/k8s-fss/applications/jupyter
```

Use Nexus PyPI explicitly if needed:

```bash
docker build \
  --build-arg PIP_INDEX_URL=http://192.168.56.31:8081/repository/pypi-proxy/simple \
  --build-arg PIP_TRUSTED_HOST=192.168.56.31 \
  -t 192.168.56.32/app/jupyter:latest \
  /home/ubuntu/k8s-fss/applications/jupyter
```

Push to Harbor:

```bash
docker push 192.168.56.32/app/jupyter:latest
```

Use the Harbor endpoint directly:

```bash
https://192.168.56.32
```

After pushing the image, restart the local backend and recreate the user pod so the new image is used.
