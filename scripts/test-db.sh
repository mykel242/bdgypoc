#!/bin/bash
# Test database connection
echo "Testing database connection..."
PGPASSWORD=budgie_dev_password psql -h localhost -U budgie_user -d budgie_dev -c "SELECT version();"
