//go:build !windows

package handlers

import (
	"os"
	"syscall"
)

func getFileInode(info os.FileInfo) (int64, bool) {
	if info == nil {
		return 0, false
	}
	st, ok := info.Sys().(*syscall.Stat_t)
	if !ok || st == nil {
		return 0, false
	}
	return int64(st.Ino), true
}
