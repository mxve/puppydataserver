#!/bin/bash

if [ -z "$1" ]; then
  echo "usage: $0 path_to_pegasus > stats.json"
  exit 1
fi
 
PEGASUS_DIR="$1"

DISK_GB=$(du -sb "$PEGASUS_DIR" 2>/dev/null | awk '{printf "%.5f",$1/1073741824}')
BLOBS_COUNT=$(ls "$PEGASUS_DIR/data/blobs"/*/* 2>/dev/null | wc -l)

cat <<EOF
{
  "disk_gb": ${DISK_GB:-0},
  "blobs": ${BLOBS_COUNT:-0},
  "custom": []
}
EOF
