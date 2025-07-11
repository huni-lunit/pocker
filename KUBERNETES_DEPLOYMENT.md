# Kubernetes Deployment Guide

This guide explains how to deploy the Pocker application to Kubernetes with proper environment variable configuration.

## Environment Variable Configuration Options

### Option 1: Using ConfigMap (Recommended)

The ConfigMap approach is the most flexible for Kubernetes deployments:

1. **Create ConfigMap** (`k8s/configmap.yaml`):
   ```yaml
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: pocker-config
   data:
     NEXT_PUBLIC_SIGNALING_SERVER_URL: "ws://signaling-server-service:8080"
   ```

2. **Reference in Deployment** (already configured in `k8s/web-deployment.yaml`):
   ```yaml
   env:
   - name: NEXT_PUBLIC_SIGNALING_SERVER_URL
     valueFrom:
       configMapKeyRef:
         name: pocker-config
         key: NEXT_PUBLIC_SIGNALING_SERVER_URL
   ```

### Option 2: Using .env.production

If you prefer using environment files:

1. **Create `.env.production`**:
   ```bash
   NEXT_PUBLIC_SIGNALING_SERVER_URL=ws://signaling-server-service:8080
   ```

2. **Update Dockerfile** to copy the file:
   ```dockerfile
   # Add this line in your Dockerfile
   COPY .env.production ./
   ```

## Deployment Steps

### 1. Build Docker Images

```bash
# Build web application
docker build -t pocker-web:latest .

# Build signaling server
docker build -t pocker-signaling:latest ./signaling-server
```

### 2. Push to Registry

```bash
# Tag and push to your container registry
docker tag pocker-web:latest your-registry/pocker-web:latest
docker tag pocker-signaling:latest your-registry/pocker-signaling:latest

docker push your-registry/pocker-web:latest
docker push your-registry/pocker-signaling:latest
```

### 3. Update Image References

Update the image references in the deployment files:
- `k8s/web-deployment.yaml`: Change `image: pocker-web:latest`
- `k8s/signaling-deployment.yaml`: Change `image: pocker-signaling:latest`

### 4. Deploy to Kubernetes

```bash
# Apply all configurations
kubectl apply -f k8s/

# Or apply individually
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/signaling-deployment.yaml
kubectl apply -f k8s/web-deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

### 5. Configure Domain and SSL

1. **Update Ingress** (`k8s/ingress.yaml`):
   - Replace `your-domain.com` with your actual domain
   - Uncomment TLS section for HTTPS

2. **Update ConfigMap** for external access:
   ```yaml
   data:
     NEXT_PUBLIC_SIGNALING_SERVER_URL: "wss://your-domain.com/signaling"
   ```

## Environment Variable Scenarios

### Internal Cluster Communication
```yaml
NEXT_PUBLIC_SIGNALING_SERVER_URL: "ws://signaling-server-service:8080"
```

### External Domain with SSL
```yaml
NEXT_PUBLIC_SIGNALING_SERVER_URL: "wss://your-domain.com/signaling"
```

### External Domain without SSL
```yaml
NEXT_PUBLIC_SIGNALING_SERVER_URL: "ws://your-domain.com/signaling"
```

### Development with External Server
```yaml
NEXT_PUBLIC_SIGNALING_SERVER_URL: "ws://localhost:8080"
```

## Updating Environment Variables

### Using ConfigMap (Runtime Updates)

```bash
# Update the ConfigMap
kubectl patch configmap pocker-config -p '{"data":{"NEXT_PUBLIC_SIGNALING_SERVER_URL":"wss://new-domain.com/signaling"}}'

# Restart deployments to pick up changes
kubectl rollout restart deployment pocker-web
```

### Using .env.production (Requires Rebuild)

1. Update `.env.production`
2. Rebuild Docker image
3. Push to registry
4. Update deployment with new image tag

## Monitoring and Troubleshooting

### Check Pod Status
```bash
kubectl get pods
kubectl logs -f deployment/pocker-web
kubectl logs -f deployment/signaling-server
```

### Check Services
```bash
kubectl get services
kubectl describe service pocker-web-service
kubectl describe service signaling-server-service
```

### Check ConfigMap
```bash
kubectl get configmap pocker-config -o yaml
```

### Test WebSocket Connection
```bash
# Port forward to test locally
kubectl port-forward service/signaling-server-service 8080:8080

# Test WebSocket connection
wscat -c ws://localhost:8080
```

## Security Considerations

1. **Use HTTPS/WSS** in production
2. **Configure CORS** properly in the signaling server
3. **Set resource limits** in deployments
4. **Use secrets** for sensitive data (if any)
5. **Enable network policies** if required

## Scaling Considerations

- **Web App**: Can scale horizontally (multiple replicas)
- **Signaling Server**: Typically single replica due to WebSocket state
- **Load Balancer**: Ensure sticky sessions for WebSocket connections

## Next.js Build-time vs Runtime Variables

**Important**: `NEXT_PUBLIC_*` variables are embedded at build time. For true runtime configuration, consider:

1. Using a configuration endpoint
2. Server-side environment variables
3. Dynamic imports with environment detection

The ConfigMap approach works because the variable is available during the container startup, which happens before the Next.js application starts. 