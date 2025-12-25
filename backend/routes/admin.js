const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const util = require('util');

const execAsync = util.promisify(exec);
const router = express.Router();

// Backup directory relative to project root
const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

// Ensure backup directory exists
async function ensureBackupDir() {
	try {
		await fs.mkdir(BACKUP_DIR, { recursive: true });
	} catch (error) {
		if (error.code !== 'EEXIST') {
			throw error;
		}
	}
}

// GET /api/admin/backups - List all backups
router.get('/backups', requireAdmin, async (req, res) => {
	try {
		await ensureBackupDir();

		const files = await fs.readdir(BACKUP_DIR);
		const backups = [];

		for (const file of files) {
			if (file.endsWith('.sql') || file.endsWith('.sql.gz')) {
				const filePath = path.join(BACKUP_DIR, file);
				const stat = await fs.stat(filePath);
				backups.push({
					filename: file,
					size: stat.size,
					created_at: stat.birthtime.toISOString(),
					modified_at: stat.mtime.toISOString(),
				});
			}
		}

		// Sort by creation date descending (newest first)
		backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

		res.json({
			backups,
			count: backups.length,
		});
	} catch (error) {
		console.error('List backups error:', error);
		res.status(500).json({
			error: 'Server Error',
			message: 'Failed to list backups',
		});
	}
});

// POST /api/admin/backups - Create a new backup
router.post('/backups', requireAdmin, async (req, res) => {
	try {
		await ensureBackupDir();

		const dbHost = process.env.DB_HOST || 'localhost';
		const dbPort = process.env.DB_PORT || '5432';
		const dbName = process.env.DB_NAME || 'budgie_dev';
		const dbUser = process.env.DB_USER || 'budgie_user';
		const dbPassword = process.env.DB_PASSWORD || 'budgie_dev_password';

		// Generate filename with timestamp
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
		const filename = `budgie_backup_${timestamp}.sql`;
		const filePath = path.join(BACKUP_DIR, filename);

		// Create backup using pg_dump
		const command = `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean --if-exists > "${filePath}"`;

		await execAsync(command);

		// Get file stats
		const stat = await fs.stat(filePath);

		res.status(201).json({
			message: 'Backup created successfully',
			backup: {
				filename,
				size: stat.size,
				created_at: stat.birthtime.toISOString(),
			},
		});
	} catch (error) {
		console.error('Create backup error:', error);
		res.status(500).json({
			error: 'Server Error',
			message: 'Failed to create backup: ' + error.message,
		});
	}
});

// GET /api/admin/backups/:filename - Download a backup
router.get('/backups/:filename', requireAdmin, async (req, res) => {
	try {
		const { filename } = req.params;

		// Validate filename to prevent directory traversal
		if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
			return res.status(400).json({
				error: 'Bad Request',
				message: 'Invalid filename',
			});
		}

		// Only allow .sql and .sql.gz files
		if (!filename.endsWith('.sql') && !filename.endsWith('.sql.gz')) {
			return res.status(400).json({
				error: 'Bad Request',
				message: 'Invalid file type',
			});
		}

		const filePath = path.join(BACKUP_DIR, filename);

		try {
			await fs.access(filePath);
		} catch {
			return res.status(404).json({
				error: 'Not Found',
				message: 'Backup file not found',
			});
		}

		res.download(filePath, filename);
	} catch (error) {
		console.error('Download backup error:', error);
		res.status(500).json({
			error: 'Server Error',
			message: 'Failed to download backup',
		});
	}
});

// DELETE /api/admin/backups/:filename - Delete a backup
router.delete('/backups/:filename', requireAdmin, async (req, res) => {
	try {
		const { filename } = req.params;

		// Validate filename to prevent directory traversal
		if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
			return res.status(400).json({
				error: 'Bad Request',
				message: 'Invalid filename',
			});
		}

		// Only allow .sql and .sql.gz files
		if (!filename.endsWith('.sql') && !filename.endsWith('.sql.gz')) {
			return res.status(400).json({
				error: 'Bad Request',
				message: 'Invalid file type',
			});
		}

		const filePath = path.join(BACKUP_DIR, filename);

		try {
			await fs.access(filePath);
		} catch {
			return res.status(404).json({
				error: 'Not Found',
				message: 'Backup file not found',
			});
		}

		await fs.unlink(filePath);

		res.json({
			message: 'Backup deleted successfully',
		});
	} catch (error) {
		console.error('Delete backup error:', error);
		res.status(500).json({
			error: 'Server Error',
			message: 'Failed to delete backup',
		});
	}
});

module.exports = router;
