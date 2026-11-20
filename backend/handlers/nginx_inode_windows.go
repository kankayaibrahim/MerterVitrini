//go:build windows

package handlers

import "os"

func getFileInode(_ os.FileInfo) (int64, bool) {
	return 0, false
}
