const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// 로그인 확인 미들웨어
const requireAuth = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ 
            success: false, 
            message: '로그인이 필요합니다.' 
        });
    }
    next();
};

// 전체 대시보드 정보 조회
router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // 전체 과목 조회
        const [subjects] = await pool.execute('SELECT * FROM subjects ORDER BY name');

        // 각 과목별 진행상황 조회
        const progressPromises = subjects.map(async (subject) => {
            const [progress] = await pool.execute(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN up.selected_answer IS NOT NULL THEN 1 ELSE 0 END) as answered,
                    SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) as correct
                FROM problems p
                LEFT JOIN user_progress up ON p.id = up.problem_id AND up.user_id = ?
                WHERE p.subject_id = ?`,
                [userId, subject.id]
            );

            const stats = progress[0];
            const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : 0;

            return {
                ...subject,
                progress: {
                    total: stats.total,
                    answered: stats.answered,
                    correct: stats.correct,
                    accuracy
                }
            };
        });

        const allSubjectsWithProgress = await Promise.all(progressPromises);
        
        // 문제풀이를 시도한 과목만 필터링 (answered > 0)
        const subjectsWithProgress = allSubjectsWithProgress.filter(subject => subject.progress.answered > 0);

        // 전체 통계 계산 (모든 과목 기준)
        const totalProblems = allSubjectsWithProgress.reduce((sum, subject) => sum + subject.progress.total, 0);
        const totalAnswered = allSubjectsWithProgress.reduce((sum, subject) => sum + subject.progress.answered, 0);
        const totalCorrect = allSubjectsWithProgress.reduce((sum, subject) => sum + subject.progress.correct, 0);
        const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

        // 최근 틀린 문제들 조회
        const [recentWrong] = await pool.execute(
            `SELECT p.*, s.name as subject_name, up.selected_answer, up.answered_at
             FROM user_progress up
             JOIN problems p ON up.problem_id = p.id
             JOIN subjects s ON p.subject_id = s.id
             WHERE up.user_id = ? AND up.is_correct = 0
             ORDER BY up.answered_at DESC
             LIMIT 5`,
            [userId]
        );

        res.json({
            success: true,
            user: {
                id: req.user.id,
                username: req.user.username
            },
            overall: {
                totalProblems,
                totalAnswered,
                totalCorrect,
                accuracy: overallAccuracy
            },
            subjects: subjectsWithProgress,
            recentWrong: recentWrong.map(problem => {
                // 정답을 1, 2, 3, 4로 변환
                const answerMap = { 'A': '1', 'B': '2', 'C': '3', 'D': '4' };
                const displayCorrectAnswer = answerMap[problem.correct_answer] || problem.correct_answer;
                
                return {
                    id: problem.id,
                    question: problem.question,
                    subjectName: problem.subject_name,
                    selectedAnswer: problem.selected_answer,
                    correctAnswer: displayCorrectAnswer,
                    answeredAt: problem.answered_at
                };
            })
        });

    } catch (error) {
        console.error('대시보드 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 특정 과목의 틀린 문제들 조회
router.get('/wrong-problems/:subject', requireAuth, async (req, res) => {
    try {
        const { subject } = req.params;
        const userId = req.user.id;

        // 과목 정보 조회
        const [subjects] = await pool.execute(
            'SELECT * FROM subjects WHERE name = ?',
            [subject]
        );

        if (subjects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '과목을 찾을 수 없습니다.' 
            });
        }

        const subjectInfo = subjects[0];

        // 틀린 문제들 조회
        const [wrongProblems] = await pool.execute(
            `SELECT p.*, up.selected_answer, up.answered_at
             FROM user_progress up
             JOIN problems p ON up.problem_id = p.id
             WHERE up.user_id = ? AND up.is_correct = 0 AND p.subject_id = ?
             ORDER BY up.answered_at DESC`,
            [userId, subjectInfo.id]
        );

        res.json({
            success: true,
            subject: subjectInfo,
            wrongProblems: wrongProblems.map(problem => {
                // 정답을 1, 2, 3, 4로 변환
                const answerMap = { 'A': '1', 'B': '2', 'C': '3', 'D': '4' };
                const displayCorrectAnswer = answerMap[problem.correct_answer] || problem.correct_answer;
                
                // 문제 내용 필드 확인 (question, content, title 순서로 확인)
                const questionText = problem.question || problem.content || problem.title || '문제 내용을 찾을 수 없습니다.';
                
                return {
                    id: problem.id,
                    question: questionText,
                    option_a: problem.option_a,
                    option_b: problem.option_b,
                    option_c: problem.option_c,
                    option_d: problem.option_d,
                    selectedAnswer: problem.selected_answer,
                    correctAnswer: displayCorrectAnswer,
                    explanation: problem.explanation,
                    answeredAt: problem.answered_at
                };
            })
        });

    } catch (error) {
        console.error('틀린 문제 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 학습 통계 조회
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        // 일별 학습 통계 (최근 7일)
        const [dailyStats] = await pool.execute(
            `SELECT 
                DATE(answered_at) as date,
                COUNT(*) as problems_solved,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_answers
             FROM user_progress 
             WHERE user_id = ? AND answered_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             GROUP BY DATE(answered_at)
             ORDER BY date DESC`,
            [userId]
        );

        // 과목별 정답률
        const [subjectStats] = await pool.execute(
            `SELECT 
                s.name as subject_name,
                COUNT(*) as total_attempts,
                SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
                ROUND((SUM(CASE WHEN up.is_correct = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) as accuracy
             FROM user_progress up
             JOIN problems p ON up.problem_id = p.id
             JOIN subjects s ON p.subject_id = s.id
             WHERE up.user_id = ?
             GROUP BY s.id, s.name
             ORDER BY accuracy DESC`,
            [userId]
        );

        res.json({
            success: true,
            dailyStats,
            subjectStats
        });

    } catch (error) {
        console.error('통계 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

module.exports = router; 