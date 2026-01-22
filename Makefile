.PHONY: help install server frontend dev capture clean kill-ports

# Default target
help:
	@echo "🎬 Vibe Logger v2.0 - Makefile Commands"
	@echo ""
	@echo "📦 Setup:"
	@echo "  make install        Install all dependencies (backend + frontend)"
	@echo ""
	@echo "🚀 Development:"
	@echo "  make dev            Run API server + Frontend (parallel)"
	@echo "  make server         Run API server only (port 3001)"
	@echo "  make frontend       Run frontend only (port 5173)"
	@echo "  make capture        Run Puppeteer capture tool"
	@echo ""
	@echo "🧹 Cleanup:"
	@echo "  make clean          Remove node_modules"
	@echo "  make kill-ports     Kill processes on ports 3001 and 5173"
	@echo ""

# Install all dependencies
install:
	@echo "📦 Installing backend dependencies..."
	npm install
	@echo "📦 Installing frontend dependencies..."
	cd interceptor && npm install
	@echo "✅ All dependencies installed!"

# Run API server
server:
	@echo "🚀 Starting API server on port 3001..."
	node api-server.js

# Run frontend
frontend:
	@echo "🚀 Starting frontend on port 5173..."
	cd interceptor && npm run dev

# Run both server and frontend in parallel
dev:
	@echo "🧹 Running cleanup..."
	@node scripts/cleanup.js
	@echo "🚀 Starting API server + Frontend..."
	@echo "📊 API Server: http://localhost:3001"
	@echo "🎨 Frontend: http://localhost:5173"
	@echo "📦 Checking database..."
	@node db.js
	@echo ""
	@make -j2 server frontend

# Run capture tool
capture:
	@echo "🎬 Starting Puppeteer capture tool..."
	node index.js

# Clean node_modules
clean:
	@echo "🧹 Removing node_modules..."
	rm -rf node_modules
	rm -rf interceptor/node_modules
	@echo "✅ Cleanup complete!"

# Kill processes on ports 3001 and 5173
kill-ports:
	@echo "🔪 Killing processes on ports 3001 and 5173..."
	-lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	-lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@echo "✅ Ports cleared!"
