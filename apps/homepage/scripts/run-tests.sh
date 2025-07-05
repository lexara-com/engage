#!/bin/bash

# Lexara Engage Test Runner
echo "🧪 Lexara Engage Test Suite"
echo "=========================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test categories
RUN_UNIT=true
RUN_INTEGRATION=true
RUN_E2E=false
RUN_COVERAGE=false
WATCH_MODE=false

# Parse arguments
for arg in "$@"
do
    case $arg in
        --unit)
            RUN_UNIT=true
            RUN_INTEGRATION=false
            RUN_E2E=false
            shift
            ;;
        --integration)
            RUN_UNIT=false
            RUN_INTEGRATION=true
            RUN_E2E=false
            shift
            ;;
        --e2e)
            RUN_UNIT=false
            RUN_INTEGRATION=false
            RUN_E2E=true
            shift
            ;;
        --all)
            RUN_UNIT=true
            RUN_INTEGRATION=true
            RUN_E2E=true
            shift
            ;;
        --coverage)
            RUN_COVERAGE=true
            shift
            ;;
        --watch)
            WATCH_MODE=true
            shift
            ;;
        *)
            ;;
    esac
done

# Function to run tests
run_tests() {
    local test_type=$1
    local test_pattern=$2
    
    echo -e "${BLUE}Running $test_type tests...${NC}"
    
    if [ "$RUN_COVERAGE" = true ]; then
        npx vitest run $test_pattern --coverage
    elif [ "$WATCH_MODE" = true ]; then
        npx vitest $test_pattern --watch
    else
        npx vitest run $test_pattern
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $test_type tests passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_type tests failed${NC}"
        return 1
    fi
}

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Create test reports directory
mkdir -p tests/reports

# Run unit tests
if [ "$RUN_UNIT" = true ]; then
    echo ""
    run_tests "Unit" "tests/unit/**/*.test.ts"
    UNIT_RESULT=$?
fi

# Run integration tests
if [ "$RUN_INTEGRATION" = true ]; then
    echo ""
    run_tests "Integration" "tests/integration/**/*.test.ts"
    INTEGRATION_RESULT=$?
fi

# Run E2E tests (if implemented)
if [ "$RUN_E2E" = true ]; then
    echo ""
    echo -e "${YELLOW}E2E tests with Playwright not yet implemented${NC}"
    E2E_RESULT=0
fi

# Summary
echo ""
echo "=========================="
echo "Test Summary:"
echo ""

if [ "$RUN_UNIT" = true ]; then
    if [ $UNIT_RESULT -eq 0 ]; then
        echo -e "${GREEN}✅ Unit tests: PASSED${NC}"
    else
        echo -e "${RED}❌ Unit tests: FAILED${NC}"
    fi
fi

if [ "$RUN_INTEGRATION" = true ]; then
    if [ $INTEGRATION_RESULT -eq 0 ]; then
        echo -e "${GREEN}✅ Integration tests: PASSED${NC}"
    else
        echo -e "${RED}❌ Integration tests: FAILED${NC}"
    fi
fi

if [ "$RUN_E2E" = true ]; then
    echo -e "${YELLOW}⚠️  E2E tests: PENDING${NC}"
fi

if [ "$RUN_COVERAGE" = true ]; then
    echo ""
    echo -e "${BLUE}Coverage report generated at: tests/reports/index.html${NC}"
fi

# Exit with failure if any tests failed
if [ "$RUN_UNIT" = true ] && [ $UNIT_RESULT -ne 0 ]; then
    exit 1
fi

if [ "$RUN_INTEGRATION" = true ] && [ $INTEGRATION_RESULT -ne 0 ]; then
    exit 1
fi

echo ""
echo -e "${GREEN}All tests completed!${NC}"