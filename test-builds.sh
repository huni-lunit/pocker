#!/bin/bash

# Test script to verify Docker builds work correctly

set -e

echo "🧪 Testing Docker builds..."

# Test web application build
echo "📦 Building web application..."
docker build -t pocker-web-test . --quiet

# Test signaling server build  
echo "📦 Building signaling server..."
docker build -t pocker-signaling-test ./signaling-server --quiet

echo "🚀 Starting test containers..."

# Start signaling server
docker run --rm -d --name test-signaling -p 8081:8080 pocker-signaling-test

# Wait for signaling server to start
echo "⏳ Waiting for signaling server to start..."
sleep 3

# Check if signaling server is running
if docker logs test-signaling | grep -q "Signaling server running"; then
    echo "✅ Signaling server started successfully"
else
    echo "❌ Signaling server failed to start"
    docker logs test-signaling
    docker stop test-signaling
    exit 1
fi

# Start web application
docker run --rm -d --name test-web -p 3001:3000 -e NEXT_PUBLIC_SIGNALING_SERVER_URL=ws://localhost:8081 pocker-web-test

# Wait for web application to start
echo "⏳ Waiting for web application to start..."
sleep 5

# Check if web application is running
if docker logs test-web | grep -q "Ready in"; then
    echo "✅ Web application started successfully"
else
    echo "❌ Web application failed to start"
    docker logs test-web
    docker stop test-signaling test-web
    exit 1
fi

echo "🧹 Cleaning up test containers..."
docker stop test-signaling test-web

echo "🎉 All builds and containers working correctly!"
echo ""
echo "📋 Summary:"
echo "  - Web application: ✅ Build successful"
echo "  - Signaling server: ✅ Build successful"
echo "  - Both containers: ✅ Start and run correctly"
echo ""
echo "🚀 Ready for deployment!" 