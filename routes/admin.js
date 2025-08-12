const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 관리자 권한 확인 미들웨어
function requireAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
    
    next();
}

// 관리자 통계 조회
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // 총 문제 수
        const [problemsResult] = await connection.execute('SELECT COUNT(*) as count FROM problems');
        const totalProblems = problemsResult[0].count;
        
        // 총 과목 수
        const [subjectsResult] = await connection.execute('SELECT COUNT(*) as count FROM subjects');
        const totalSubjects = subjectsResult[0].count;
        
        // 총 사용자 수
        const [usersResult] = await connection.execute('SELECT COUNT(*) as count FROM users');
        const totalUsers = usersResult[0].count;
        
        // 총 풀이 시도 수
        const [attemptsResult] = await connection.execute('SELECT COUNT(*) as count FROM user_progress');
        const totalAttempts = attemptsResult[0].count;
        
        connection.release();
        
        res.json({
            success: true,
            stats: {
                totalProblems,
                totalSubjects,
                totalUsers,
                totalAttempts
            }
        });
    } catch (error) {
        console.error('관리자 통계 조회 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 개별 문제 조회
router.get('/problems/:id', requireAdmin, async (req, res) => {
    try {
        const problemId = req.params.id;
        
        const connection = await pool.getConnection();
        
        const [problems] = await connection.execute(`
            SELECT p.*, s.name as subject_name 
            FROM problems p 
            JOIN subjects s ON p.subject_id = s.id 
            WHERE p.id = ?
        `, [problemId]);
        
        connection.release();
        
        if (problems.length === 0) {
            return res.status(404).json({ success: false, message: '문제를 찾을 수 없습니다.' });
        }
        
        res.json({
            success: true,
            problem: problems[0]
        });
    } catch (error) {
        console.error('개별 문제 조회 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 모든 문제 목록 조회
router.get('/problems', requireAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [problems] = await connection.execute(`
            SELECT p.*, s.name as subject_name,
                   ROW_NUMBER() OVER (PARTITION BY p.subject_id ORDER BY p.id) as subject_problem_number
            FROM problems p 
            JOIN subjects s ON p.subject_id = s.id 
            ORDER BY s.sort_order ASC, p.id ASC
        `);
        
        connection.release();
        
        res.json({
            success: true,
            problems
        });
    } catch (error) {
        console.error('문제 목록 조회 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 새 문제 추가
router.post('/problems', requireAdmin, async (req, res) => {
    try {
        const {
            subject_id,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_answer,
            explanation,
            difficulty
        } = req.body;
        
        // 입력 검증
        if (!subject_id || !question || !option_a || !option_b || !option_c || !option_d || !correct_answer || !explanation || !difficulty) {
            return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요.' });
        }
        
        // 1, 2, 3, 4를 A, B, C, D로 변환
        const answerMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        const dbCorrectAnswer = answerMap[correct_answer];
        
        if (!dbCorrectAnswer) {
            return res.status(400).json({ success: false, message: '올바른 정답을 선택해주세요.' });
        }
        
        if (!['easy', 'medium', 'hard'].includes(difficulty)) {
            return res.status(400).json({ success: false, message: '올바른 난이도를 선택해주세요.' });
        }
        
        const connection = await pool.getConnection();
        
        // 문제 추가
        const [result] = await connection.execute(`
            INSERT INTO problems (subject_id, question, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [subject_id, question, option_a, option_b, option_c, option_d, dbCorrectAnswer, explanation, difficulty]);
        
        // 과목의 총 문제 수 업데이트
        await connection.execute(`
            UPDATE subjects 
            SET total_problems = (SELECT COUNT(*) FROM problems WHERE subject_id = ?)
            WHERE id = ?
        `, [subject_id, subject_id]);
        
        connection.release();
        
        res.json({
            success: true,
            message: '문제가 성공적으로 추가되었습니다.',
            problemId: result.insertId
        });
    } catch (error) {
        console.error('문제 추가 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 문제 수정
router.put('/problems/:id', requireAdmin, async (req, res) => {
    try {
        const problemId = req.params.id;
        const {
            subject_id,
            question,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_answer,
            explanation,
            difficulty
        } = req.body;
        
        // 입력 검증
        if (!subject_id || !question || !option_a || !option_b || !option_c || !option_d || !correct_answer || !explanation || !difficulty) {
            return res.status(400).json({ success: false, message: '모든 필드를 입력해주세요.' });
        }
        
        // 1, 2, 3, 4를 A, B, C, D로 변환
        const answerMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        const dbCorrectAnswer = answerMap[correct_answer];
        
        if (!dbCorrectAnswer) {
            return res.status(400).json({ success: false, message: '올바른 정답을 선택해주세요.' });
        }
        
        if (!['easy', 'medium', 'hard'].includes(difficulty)) {
            return res.status(400).json({ success: false, message: '올바른 난이도를 선택해주세요.' });
        }
        
        const connection = await pool.getConnection();
        
        // 기존 문제 정보 조회 (과목 ID 확인용)
        const [existingProblem] = await connection.execute('SELECT subject_id FROM problems WHERE id = ?', [problemId]);
        
        if (existingProblem.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, message: '문제를 찾을 수 없습니다.' });
        }
        
        const oldSubjectId = existingProblem[0].subject_id;
        
        // 문제 수정
        await connection.execute(`
            UPDATE problems 
            SET subject_id = ?, question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, 
                correct_answer = ?, explanation = ?, difficulty = ?
            WHERE id = ?
        `, [subject_id, question, option_a, option_b, option_c, option_d, dbCorrectAnswer, explanation, difficulty, problemId]);
        
        // 과목의 총 문제 수 업데이트 (기존 과목과 새 과목 모두)
        await connection.execute(`
            UPDATE subjects 
            SET total_problems = (SELECT COUNT(*) FROM problems WHERE subject_id = ?)
            WHERE id = ?
        `, [oldSubjectId, oldSubjectId]);
        
        if (oldSubjectId !== parseInt(subject_id)) {
            await connection.execute(`
                UPDATE subjects 
                SET total_problems = (SELECT COUNT(*) FROM problems WHERE subject_id = ?)
                WHERE id = ?
            `, [subject_id, subject_id]);
        }
        
        connection.release();
        
        res.json({
            success: true,
            message: '문제가 성공적으로 수정되었습니다.'
        });
    } catch (error) {
        console.error('문제 수정 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 문제 삭제
router.delete('/problems/:id', requireAdmin, async (req, res) => {
    try {
        const problemId = parseInt(req.params.id);
        
        const connection = await pool.getConnection();
        
        // 문제 정보 조회 (과목 ID 확인용)
        const [problemResult] = await connection.execute('SELECT subject_id FROM problems WHERE id = ?', [problemId]);
        
        if (problemResult.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, message: '문제를 찾을 수 없습니다.' });
        }
        
        const subjectId = problemResult[0].subject_id;
        
        // 삭제할 문제를 마지막 진행상황으로 가지고 있는 사용자들 찾기
        const [affectedUsers] = await connection.execute(
            'SELECT user_id FROM user_subject_progress WHERE last_problem_id = ?',
            [problemId]
        );
        
        // 해당 과목의 모든 문제 목록 조회 (삭제될 문제 제외, ID 순서로)
        const [remainingProblems] = await connection.execute(
            'SELECT id FROM problems WHERE subject_id = ? AND id != ? ORDER BY id',
            [subjectId, problemId]
        );
        
        // 문제 삭제 (CASCADE로 user_progress도 자동 삭제됨)
        await connection.execute('DELETE FROM problems WHERE id = ?', [problemId]);
        
        // 영향받은 사용자들의 진행상황 업데이트
        if (affectedUsers.length > 0 && remainingProblems.length > 0) {
            console.log(`문제 ${problemId} 삭제 - ${affectedUsers.length}명의 사용자 진행상황 업데이트 필요`);
            
            for (const user of affectedUsers) {
                // 삭제된 문제 이후의 가장 가까운 문제 찾기
                let nextProblemId = null;
                
                // 사용자가 이미 푼 문제들 조회
                const [solvedProblems] = await connection.execute(
                    'SELECT problem_id FROM user_progress WHERE user_id = ? AND problem_id IN (' + 
                    remainingProblems.map(() => '?').join(',') + ')',
                    [user.user_id, ...remainingProblems.map(p => p.id)]
                );
                
                const solvedIds = new Set(solvedProblems.map(p => p.problem_id));
                
                // 아직 풀지 않은 첫 번째 문제 찾기
                for (const problem of remainingProblems) {
                    if (!solvedIds.has(problem.id)) {
                        nextProblemId = problem.id;
                        break;
                    }
                }
                
                // 모든 문제를 다 풀었다면 마지막 문제로 설정
                if (!nextProblemId && remainingProblems.length > 0) {
                    nextProblemId = remainingProblems[remainingProblems.length - 1].id;
                }
                
                // 진행상황 업데이트
                if (nextProblemId) {
                    await connection.execute(
                        'UPDATE user_subject_progress SET last_problem_id = ? WHERE user_id = ? AND subject_id = ?',
                        [nextProblemId, user.user_id, subjectId]
                    );
                    console.log(`사용자 ${user.user_id}: 진행상황을 문제 ${nextProblemId}로 업데이트`);
                } else {
                    // 남은 문제가 없으면 NULL로 설정 (처음부터 시작)
                    await connection.execute(
                        'UPDATE user_subject_progress SET last_problem_id = NULL WHERE user_id = ? AND subject_id = ?',
                        [user.user_id, subjectId]
                    );
                    console.log(`사용자 ${user.user_id}: 남은 문제가 없어 진행상황 초기화`);
                }
            }
        }
        
        // 과목의 총 문제 수 업데이트
        await connection.execute(`
            UPDATE subjects 
            SET total_problems = (SELECT COUNT(*) FROM problems WHERE subject_id = ?)
            WHERE id = ?
        `, [subjectId, subjectId]);
        
        connection.release();
        
        res.json({
            success: true,
            message: '문제가 성공적으로 삭제되었습니다.'
        });
    } catch (error) {
        console.error('문제 삭제 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 과목 추가
router.post('/subjects', requireAdmin, async (req, res) => {
    try {
        const { name, description, category, is_public } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: '과목명을 입력해주세요.' });
        }
        
        if (!category) {
            return res.status(400).json({ success: false, message: '카테고리를 입력해주세요.' });
        }
        
        const connection = await pool.getConnection();
        
        const [result] = await connection.execute(`
            INSERT INTO subjects (name, description, category, total_problems, is_public)
            VALUES (?, ?, ?, 0, ?)
        `, [name, description || '', category, is_public || false]);
        
        connection.release();
        
        res.json({
            success: true,
            message: '과목이 성공적으로 추가되었습니다.',
            subjectId: result.insertId
        });
    } catch (error) {
        console.error('과목 추가 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 과목 목록 조회
router.get('/subjects', requireAdmin, async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        const [subjects] = await connection.execute(`
            SELECT s.*, COUNT(p.id) as problem_count
            FROM subjects s
            LEFT JOIN problems p ON s.id = p.subject_id
            GROUP BY s.id
            ORDER BY s.sort_order ASC, s.id ASC
        `);
        
        connection.release();
        
        res.json({
            success: true,
            subjects
        });
    } catch (error) {
        console.error('과목 목록 조회 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 과목 순서 변경
router.put('/subjects/order', requireAdmin, async (req, res) => {
    try {
        const { subjects } = req.body; // [{id: 1, sort_order: 1}, {id: 2, sort_order: 2}, ...]
        
        if (!Array.isArray(subjects)) {
            return res.status(400).json({ success: false, message: '올바른 형식의 데이터가 아닙니다.' });
        }
        
        const connection = await pool.getConnection();
        
        // 트랜잭션 시작
        await connection.beginTransaction();
        
        try {
            for (const subject of subjects) {
                await connection.execute(`
                    UPDATE subjects 
                    SET sort_order = ? 
                    WHERE id = ?
                `, [subject.sort_order, subject.id]);
            }
            
            await connection.commit();
            connection.release();
            
            res.json({
                success: true,
                message: '과목 순서가 성공적으로 변경되었습니다.'
            });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('과목 순서 변경 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 과목 수정
router.put('/subjects/:id', requireAdmin, async (req, res) => {
    try {
        const subjectId = req.params.id;
        const { name, description, category, is_public } = req.body;
        
        if (!name) {
            return res.status(400).json({ success: false, message: '과목명을 입력해주세요.' });
        }
        
        if (!category) {
            return res.status(400).json({ success: false, message: '카테고리를 입력해주세요.' });
        }
        
        const connection = await pool.getConnection();
        
        // 과목 존재 여부 확인
        const [existingSubject] = await connection.execute('SELECT * FROM subjects WHERE id = ?', [subjectId]);
        
        if (existingSubject.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, message: '과목을 찾을 수 없습니다.' });
        }
        
        // 과목 수정
        await connection.execute(`
            UPDATE subjects 
            SET name = ?, description = ?, category = ?, is_public = ?
            WHERE id = ?
        `, [name, description || '', category, is_public || false, subjectId]);
        
        connection.release();
        
        res.json({
            success: true,
            message: '과목이 성공적으로 수정되었습니다.'
        });
    } catch (error) {
        console.error('과목 수정 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 과목 공개/비공개 상태 변경
router.put('/subjects/:id/public-status', requireAdmin, async (req, res) => {
    try {
        const subjectId = req.params.id;
        const { is_public } = req.body;
        
        if (typeof is_public !== 'boolean') {
            return res.status(400).json({ success: false, message: '올바른 공개 상태 값이 아닙니다.' });
        }
        
        const connection = await pool.getConnection();
        
        // 과목 존재 여부 확인
        const [existingSubject] = await connection.execute('SELECT * FROM subjects WHERE id = ?', [subjectId]);
        
        if (existingSubject.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, message: '과목을 찾을 수 없습니다.' });
        }
        
        // 공개 상태 변경
        await connection.execute(`
            UPDATE subjects 
            SET is_public = ?
            WHERE id = ?
        `, [is_public, subjectId]);
        
        connection.release();
        
        res.json({
            success: true,
            message: `과목이 ${is_public ? '공개' : '비공개'}로 설정되었습니다.`
        });
    } catch (error) {
        console.error('과목 공개 상태 변경 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 과목 삭제
router.delete('/subjects/:id', requireAdmin, async (req, res) => {
    try {
        const subjectId = req.params.id;
        
        const connection = await pool.getConnection();
        
        // 과목에 속한 문제가 있는지 확인
        const [problemsResult] = await connection.execute('SELECT COUNT(*) as count FROM problems WHERE subject_id = ?', [subjectId]);
        
        if (problemsResult[0].count > 0) {
            connection.release();
            return res.status(400).json({ 
                success: false, 
                message: '이 과목에 속한 문제가 있어서 삭제할 수 없습니다. 먼저 모든 문제를 삭제해주세요.' 
            });
        }
        
        // 과목 삭제
        const [result] = await connection.execute('DELETE FROM subjects WHERE id = ?', [subjectId]);
        
        if (result.affectedRows === 0) {
            connection.release();
            return res.status(404).json({ success: false, message: '과목을 찾을 수 없습니다.' });
        }
        
        connection.release();
        
        res.json({
            success: true,
            message: '과목이 성공적으로 삭제되었습니다.'
        });
    } catch (error) {
        console.error('과목 삭제 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router; 