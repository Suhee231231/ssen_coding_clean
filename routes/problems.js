const express = require('express');
const { pool } = require('../config/database');
const { requireAuth, optionalAuth } = require('../middleware/jwt-auth');

const router = express.Router();

// 통계 데이터만 조회 (단일 쿼리 최적화)
router.get('/stats', async (req, res) => {
    try {
        const [results] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM problems) as total_count,
                (SELECT MAX(created_at) FROM problems) as latest_update,
                (SELECT COUNT(*) FROM subjects WHERE is_public = TRUE) as subject_count
        `);
        
        res.json({ 
            success: true, 
            totalProblems: results[0].total_count,
            totalSubjects: results[0].subject_count,
            latestUpdate: results[0].latest_update
        });
    } catch (error) {
        console.error('통계 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 과목별 문제 목록 조회 (최적화된 버전)
router.get('/subjects', async (req, res) => {
    try {
        // 단일 쿼리로 모든 데이터를 한 번에 가져오기
        const [results] = await pool.execute(`
            SELECT 
                s.*,
                COUNT(p.id) as problem_count
            FROM subjects s
            LEFT JOIN problems p ON s.id = p.subject_id
            WHERE s.is_public = TRUE
            GROUP BY s.id
            ORDER BY s.sort_order ASC, s.name ASC
        `);
        
        res.json({ 
            success: true, 
            subjects: results
        });
    } catch (error) {
        console.error('과목 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 특정 과목의 문제 조회 (로그인하지 않은 사용자도 접근 가능) - 최적화된 버전
router.get('/:subject', optionalAuth, async (req, res) => {
    try {
        const { subject } = req.params;
        const { id } = req.query;

        // 단일 쿼리로 과목 정보와 문제 목록을 한 번에 가져오기
        const [results] = await pool.execute(`
            SELECT 
                s.*,
                p.id as problem_id,
                p.content,
                p.option_a,
                p.option_b,
                p.option_c,
                p.option_d,
                p.difficulty,
                p.correct_answer,
                p.explanation,
                COUNT(*) OVER (PARTITION BY s.id) as total_problems
            FROM subjects s
            LEFT JOIN problems p ON s.id = p.subject_id
            WHERE s.name = ? AND s.is_public = TRUE
            ORDER BY p.id
        `, [subject]);

        if (results.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '과목을 찾을 수 없습니다.' 
            });
        }

        const subjectInfo = {
            id: results[0].id,
            name: results[0].name,
            description: results[0].description,
            category: results[0].category,
            is_public: results[0].is_public,
            sort_order: results[0].sort_order
        };

        const problems = results.filter(r => r.problem_id).map(r => ({
            id: r.problem_id,
            content: r.content,
            option_a: r.option_a,
            option_b: r.option_b,
            option_c: r.option_c,
            option_d: r.option_d,
            difficulty: r.difficulty,
            correct_answer: r.correct_answer,
            explanation: r.explanation
        }));

        const totalProblems = results[0].total_problems || 0;
        
        if (problems.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '해당 과목에 문제가 없습니다.' 
            });
        }
        
        let problemIndex = 0; // 기본값: 첫 번째 문제
        
        if (id && id !== 'null' && !isNaN(parseInt(id))) {
            // 특정 순서의 문제 조회
            problemIndex = parseInt(id) - 1;
        } else if (req.user && req.user.id) {
            // 로그인한 사용자의 경우 진행상황 확인 - 최적화된 쿼리
            try {
                const [progressData] = await pool.execute(`
                    SELECT 
                        usp.last_problem_id,
                        up.is_correct,
                        up.answered_at
                    FROM user_subject_progress usp
                    LEFT JOIN user_progress up ON usp.last_problem_id = up.problem_id AND up.user_id = ?
                    WHERE usp.user_id = ? AND usp.subject_id = ?
                `, [req.user.id, req.user.id, subjectInfo.id]);
                
                if (progressData.length > 0 && progressData[0].last_problem_id) {
                    const lastProblemIndex = problems.findIndex(p => p.id === progressData[0].last_problem_id);
                    
                    if (lastProblemIndex !== -1) {
                        if (progressData[0].is_correct) {
                            // 마지막 문제가 이미 완료되었으므로 다음 문제로 이동
                            const nextIndex = lastProblemIndex + 1;
                            problemIndex = nextIndex < problems.length ? nextIndex : problems.length - 1;
                        } else {
                            // 마지막 문제가 아직 완료되지 않았으므로 해당 문제부터 시작
                            problemIndex = lastProblemIndex;
                        }
                    } else {
                        // 저장된 문제가 현재 문제 목록에 없음 - 다음 문제 찾기
                        const [solvedProblems] = await pool.execute(`
                            SELECT problem_id 
                            FROM user_progress 
                            WHERE user_id = ? AND problem_id IN (${problems.map(() => '?').join(',')})
                        `, [req.user.id, ...problems.map(p => p.id)]);
                        
                        const solvedIds = new Set(solvedProblems.map(p => p.problem_id));
                        const unsolvedIndex = problems.findIndex(p => !solvedIds.has(p.id));
                        problemIndex = unsolvedIndex !== -1 ? unsolvedIndex : problems.length - 1;
                        
                        // 진행상황 업데이트
                        await pool.execute(
                            'UPDATE user_subject_progress SET last_problem_id = ? WHERE user_id = ? AND subject_id = ?',
                            [problems[problemIndex].id, req.user.id, subjectInfo.id]
                        );
                    }
                }
            } catch (error) {
                console.error('진행 상황 조회 오류:', error);
            }
        }
        
        // problemIndex 범위 검증
        if (problemIndex >= problems.length) {
            problemIndex = problems.length - 1;
        } else if (problemIndex < 0) {
            problemIndex = 0;
        }
        
        const problem = problems[problemIndex];

        // 사용자 진행상황 조회 - 최적화된 쿼리
        let userProgress = null;
        if (req.user && req.user.id) {
            const [progress] = await pool.execute(
                'SELECT selected_answer, is_correct, answered_at FROM user_progress WHERE user_id = ? AND problem_id = ?',
                [req.user.id, problem.id]
            );
            userProgress = progress[0];
        }

        res.json({
            success: true,
            subject: subjectInfo,
            problem: {
                id: problem.id,
                content: problem.content,
                option_a: problem.option_a,
                option_b: problem.option_b,
                option_c: problem.option_c,
                option_d: problem.option_d,
                difficulty: problem.difficulty
            },
            problemNumber: problemIndex + 1,
            totalProblems,
            userProgress
        });

    } catch (error) {
        console.error('문제 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 답안 제출 (로그인하지 않은 사용자도 접근 가능) - 최적화된 버전
router.post('/:subject/submit', optionalAuth, async (req, res) => {
    try {
        const { subject } = req.params;
        const { problemId, answer } = req.body;

        if (!problemId || !answer) {
            return res.status(400).json({ 
                success: false, 
                message: '문제 ID와 답안을 입력해주세요.' 
            });
        }

        // 문제 조회 - 필요한 필드만 선택
        const [problems] = await pool.execute(
            'SELECT id, subject_id, correct_answer, explanation FROM problems WHERE id = ?',
            [problemId]
        );

        if (problems.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '문제를 찾을 수 없습니다.' 
            });
        }

        const problem = problems[0];
        
        // 답안 검증
        const answerMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        const dbAnswer = answerMap[answer] || answer.toUpperCase();
        const isCorrect = dbAnswer === problem.correct_answer;

        // 사용자 진행상황 저장 (JWT 토큰으로 인증된 경우) - 최적화된 버전
        if (req.user && req.user.id) {
            try {
                // 트랜잭션으로 두 작업을 한 번에 처리
                const connection = await pool.getConnection();
                await connection.beginTransaction();
                
                try {
                    // 문제 풀이 기록 저장
                    await connection.execute(
                        `INSERT INTO user_progress (user_id, problem_id, selected_answer, is_correct, answered_at) 
                         VALUES (?, ?, ?, ?, NOW()) 
                         ON DUPLICATE KEY UPDATE 
                         selected_answer = VALUES(selected_answer), 
                         is_correct = VALUES(is_correct),
                         answered_at = NOW()`,
                        [req.user.id, problemId, dbAnswer, isCorrect]
                    );
                    
                    // 과목별 마지막 진행 상황 저장
                    await connection.execute(
                        `INSERT INTO user_subject_progress (user_id, subject_id, last_problem_id) 
                         VALUES (?, ?, ?) 
                         ON DUPLICATE KEY UPDATE 
                         last_problem_id = VALUES(last_problem_id)`,
                        [req.user.id, problem.subject_id, problemId]
                    );
                    
                    await connection.commit();
                } catch (error) {
                    await connection.rollback();
                    throw error;
                } finally {
                    connection.release();
                }
            } catch (error) {
                console.error('진행상황 저장 오류:', error);
                // 진행상황 저장 실패해도 답안 검증 결과는 반환
            }
        }

        // 정답을 1, 2, 3, 4로 변환 (화면 표시용)
        const displayAnswerMap = { 'A': '1', 'B': '2', 'C': '3', 'D': '4' };
        const displayCorrectAnswer = displayAnswerMap[problem.correct_answer] || problem.correct_answer;
        
        res.json({
            success: true,
            isCorrect,
            correctAnswer: displayCorrectAnswer,
            explanation: problem.explanation
        });

    } catch (error) {
        console.error('답안 제출 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 틀린 문제풀이용 답안 제출 (진행상황 업데이트 없음)
router.post('/:subject/wrong-submit', requireAuth, async (req, res) => {
    try {
        const { subject } = req.params;
        const { problemId, answer } = req.body;

        if (!problemId || !answer) {
            return res.status(400).json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

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

        // 문제 정보 조회
        const [problems] = await pool.execute(
            'SELECT * FROM problems WHERE id = ? AND subject_id = ?',
            [problemId, subjectInfo.id]
        );

        if (problems.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '문제를 찾을 수 없습니다.' 
            });
        }

        const problem = problems[0];

        // 답안을 A, B, C, D로 변환
        const answerMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        const dbAnswer = answerMap[answer] || answer;

        // 정답 확인
        const isCorrect = dbAnswer === problem.correct_answer;

        // 정답을 1, 2, 3, 4로 변환 (화면 표시용)
        const displayAnswerMap = { 'A': '1', 'B': '2', 'C': '3', 'D': '4' };
        const displayCorrectAnswer = displayAnswerMap[problem.correct_answer] || problem.correct_answer;
        
        res.json({
            success: true,
            isCorrect,
            correctAnswer: displayCorrectAnswer,
            explanation: problem.explanation
        });

    } catch (error) {
        console.error('틀린 문제 답안 제출 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 진행 상황 저장 (페이지 벗어날 때, 로그인한 사용자만)
router.post('/save-progress', requireAuth, async (req, res) => {
    try {
        const { problemId, subject } = req.body;
        
        if (!req.user || !req.user.id || !problemId) {
            return res.status(200).json({ success: true });
        }
        
        const connection = await pool.getConnection();
        
        // 문제 정보 조회
        const [problems] = await connection.execute(
            'SELECT subject_id FROM problems WHERE id = ?',
            [problemId]
        );
        
        if (problems.length > 0) {
            // 과목별 마지막 진행 상황 저장
            await connection.execute(
                `INSERT INTO user_subject_progress (user_id, subject_id, last_problem_id) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 last_problem_id = VALUES(last_problem_id)`,
                [req.user.id, problems[0].subject_id, problemId]
            );
        }
        
        connection.release();
        res.json({ success: true });
        
    } catch (error) {
        console.error('진행 상황 저장 오류:', error);
        res.status(200).json({ success: true }); // 오류가 있어도 페이지 이동을 방해하지 않음
    }
});

// 사용자 진행상황 조회
router.get('/:subject/progress', async (req, res) => {
    try {
        if (!req.isAuthenticated() || !req.user || !req.user.id) {
            return res.status(401).json({ 
                success: false, 
                message: '로그인이 필요합니다.' 
            });
        }

        const { subject } = req.params;

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

        // 사용자 진행상황 조회
        const [progress] = await pool.execute(
            `SELECT p.*, up.selected_answer, up.is_correct, up.answered_at
             FROM problems p
             LEFT JOIN user_progress up ON p.id = up.problem_id AND up.user_id = ?
             WHERE p.subject_id = ?
             ORDER BY p.id`,
            [req.user.id, subjectInfo.id]
        );

        const totalProblems = progress.length;
        const answeredProblems = progress.filter(p => p.selected_answer).length;
        const correctAnswers = progress.filter(p => p.is_correct).length;
        const wrongProblems = progress.filter(p => p.selected_answer && !p.is_correct);

        res.json({
            success: true,
            subject: subjectInfo,
            progress: {
                total: totalProblems,
                answered: answeredProblems,
                correct: correctAnswers,
                accuracy: answeredProblems > 0 ? Math.round((correctAnswers / answeredProblems) * 100) : 0,
                wrongProblems: wrongProblems.map(p => {
                    // 정답을 1, 2, 3, 4로 변환
                    const answerMap = { 'A': '1', 'B': '2', 'C': '3', 'D': '4' };
                    const displayCorrectAnswer = answerMap[p.correct_answer] || p.correct_answer;
                    
                    return {
                        id: p.id,
                        question: p.content || p.title, // content 필드 우선, 없으면 title 필드 사용
                        option_a: p.option_a,
                        option_b: p.option_b,
                        option_c: p.option_c,
                        option_d: p.option_d,
                        selectedAnswer: p.selected_answer,
                        correctAnswer: displayCorrectAnswer
                    };
                })
            }
        });

    } catch (error) {
        console.error('진행상황 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 틀린 문제 제거 및 정답률 업데이트
router.post('/:subject/remove-wrong-problems', async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ 
                success: false, 
                message: '로그인이 필요합니다.' 
            });
        }

        const { subject } = req.params;
        const { problemIds } = req.body;

        if (!problemIds || !Array.isArray(problemIds) || problemIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: '제거할 문제 ID가 필요합니다.' 
            });
        }

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

        // 해당 과목의 문제들만 필터링
        const [allProblems] = await pool.execute(
            'SELECT id FROM problems WHERE subject_id = ?',
            [subjectInfo.id]
        );
        
        // MySQL에서 IN (?) 구문이 배열을 제대로 처리하지 못할 수 있으므로 수동으로 처리
        const placeholders = problemIds.map(() => '?').join(',');
        const [problems] = await pool.execute(
            `SELECT id FROM problems WHERE subject_id = ? AND id IN (${placeholders})`,
            [subjectInfo.id, ...problemIds]
        );

        const validProblemIds = problems.map(p => p.id);

        if (validProblemIds.length === 0) {
            // 유효한 문제가 없어도 성공으로 처리 (이미 정답이거나 문제가 없는 경우)
            return res.json({ 
                success: true, 
                message: '처리할 틀린 문제가 없습니다.',
                removedCount: 0
            });
        }

        // user_progress 테이블에 해당 문제들의 기록이 있는지 확인
        const progressPlaceholders = validProblemIds.map(() => '?').join(',');
        const [existingProgress] = await pool.execute(
            `SELECT problem_id FROM user_progress WHERE user_id = ? AND problem_id IN (${progressPlaceholders})`,
            [req.user.id, ...validProblemIds]
        );

        const existingProblemIds = existingProgress.map(p => p.problem_id);
        const newProblemIds = validProblemIds.filter(id => !existingProblemIds.includes(id));

        // 기존 기록이 있는 문제들은 정답으로 업데이트
        if (existingProblemIds.length > 0) {
            const updatePlaceholders = existingProblemIds.map(() => '?').join(',');
            await pool.execute(
                `UPDATE user_progress SET is_correct = TRUE WHERE user_id = ? AND problem_id IN (${updatePlaceholders})`,
                [req.user.id, ...existingProblemIds]
            );
        }

        // 새로 추가할 문제들은 정답으로 INSERT
        if (newProblemIds.length > 0) {
            for (const problemId of newProblemIds) {
                await pool.execute(
                    'INSERT INTO user_progress (user_id, problem_id, is_correct, answered_at) VALUES (?, ?, TRUE, NOW())',
                    [req.user.id, problemId]
                );
            }
        }

        res.json({ 
            success: true, 
            message: `${validProblemIds.length}개의 틀린 문제가 제거되었습니다.`,
            removedCount: validProblemIds.length
        });

    } catch (error) {
        console.error('틀린 문제 제거 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 개별 문제 페이지를 위한 SEO 친화적인 라우트 추가 (프리뷰 형태)
router.get('/:subject/problem/:id', optionalAuth, async (req, res) => {
    try {
        const { subject, id } = req.params;
        
        // 과목 정보 조회
        const [subjectResults] = await pool.execute(
            'SELECT * FROM subjects WHERE name = ? AND is_public = TRUE',
            [subject]
        );
        
        if (subjectResults.length === 0) {
            return res.status(404).send('과목을 찾을 수 없습니다.');
        }
        
        const subjectInfo = subjectResults[0];
        
        // 특정 문제 조회
        const [problemResults] = await pool.execute(`
            SELECT p.*, s.name as subject_name 
            FROM problems p 
            JOIN subjects s ON p.subject_id = s.id 
            WHERE s.name = ? AND p.id = ?
        `, [subject, id]);
        
        if (problemResults.length === 0) {
            return res.status(404).send('문제를 찾을 수 없습니다.');
        }
        
        const problem = problemResults[0];
        
        // HTML 페이지 생성 (프리뷰 형태)
        const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${problem.content.substring(0, 50)}... | ${subjectInfo.name} | 쎈코딩</title>
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="${problem.content.replace(/<[^>]*>/g, '').substring(0, 160)}...">
    <meta name="keywords" content="${subjectInfo.name}, 코딩문제, 프로그래밍, ${subjectInfo.category || '코딩'}">
    <meta name="author" content="쎈코딩">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://ssencoding.com/problems/${subject}/problem/${id}">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${problem.content.substring(0, 50)}... | ${subjectInfo.name}">
    <meta property="og:description" content="${problem.content.replace(/<[^>]*>/g, '').substring(0, 160)}...">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://ssencoding.com/problems/${subject}/problem/${id}">
    <meta property="og:site_name" content="쎈코딩">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${problem.content.substring(0, 50)}... | ${subjectInfo.name}">
    <meta name="twitter:description" content="${problem.content.replace(/<[^>]*>/g, '').substring(0, 160)}...">
    
    <!-- Structured Data (JSON-LD) -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "${problem.content.substring(0, 100)}...",
        "description": "${problem.content.replace(/<[^>]*>/g, '').substring(0, 200)}...",
        "author": {
            "@type": "Organization",
            "name": "쎈코딩"
        },
        "publisher": {
            "@type": "Organization",
            "name": "쎈코딩",
            "url": "https://ssencoding.com"
        },
        "datePublished": "${problem.created_at}",
        "dateModified": "${problem.updated_at || problem.created_at}",
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": "https://ssencoding.com/problems/${subject}/problem/${id}"
        },
        "about": {
            "@type": "Thing",
            "name": "${subjectInfo.name}"
        }
    }
    </script>
    
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <link rel="stylesheet" href="/css/style.css?v=1.1">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-sql.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-clike.min.js"></script>
    <script>
        // C# 언어 지원 명시적 등록
        if (window.Prism && window.Prism.languages) {
            window.Prism.languages.csharp = window.Prism.languages.extend('clike', {
                'keyword': /\b(?:abstract|as|async|await|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|ref|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|virtual|void|volatile|while|yield)\b/,
                'string': /@?("|')(\1\1|\\\1|\\?(?!\1)[\s\S])*\1/,
                'number': /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?f?/i
            });
        }
    </script>
</head>
<body>
    <header>
        <nav>
            <div class="nav-container">
                <h2 class="logo"><a href="/" style="text-decoration: none; color: inherit;"><span class="logo-highlight">SSEN</span><span class="logo-underline">C</span>ODING</a></h2>
                <div class="nav-links">
                    <a href="/">홈</a>
                    <a href="/problems.html">문제 풀이</a>
                </div>
            </div>
        </nav>
    </header>
    
    <main>
        <div class="problem-container">
            <div class="problem-header">
                <h2>${subjectInfo.name} - 문제 미리보기</h2>
                <div class="problem-info-row">
                    <p>문제 ${id}</p>
                    <span class="difficulty-badge difficulty-${problem.difficulty}">${problem.difficulty}</span>
                </div>
            </div>
            
            <div class="problem-question">
                ${problem.content}
            </div>
            
            <div class="options-container">
                <div class="option">
                    <strong>A.</strong> ${problem.option_a}
                </div>
                <div class="option">
                    <strong>B.</strong> ${problem.option_b}
                </div>
                <div class="option">
                    <strong>C.</strong> ${problem.option_c}
                </div>
                <div class="option">
                    <strong>D.</strong> ${problem.option_d}
                </div>
            </div>
            
            <div class="explanation">
                <h3>정답: ${problem.correct_answer}</h3>
                <div class="explanation-content">
                    ${problem.explanation || '설명이 없습니다.'}
                </div>
            </div>
            
            <div class="navigation-buttons" style="margin-top: 2rem;">
                <a href="/problems.html?subject=${subject}" class="nav-btn primary" style="text-decoration: none; padding: 12px 24px; background: #00d4aa; color: white; border-radius: 6px; font-weight: 500;">
                    🎯 이 과목 문제 풀기
                </a>
                <a href="/" class="nav-btn" style="text-decoration: none; padding: 12px 24px; background: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 6px; margin-left: 10px;">
                    🏠 홈으로 가기
                </a>
            </div>
            
            <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #00d4aa;">
                <h4 style="margin: 0 0 0.5rem 0; color: #00d4aa;">💡 학습 팁</h4>
                <p style="margin: 0; color: #666; font-size: 0.9rem;">
                    이 문제를 포함한 ${subjectInfo.name} 과목의 모든 문제를 순차적으로 풀어보세요. 
                    진행상황이 자동으로 저장되어 언제든지 이어서 학습할 수 있습니다.
                </p>
            </div>
        </div>
    </main>
    
    <script>
        // 코드 하이라이팅 적용
        document.addEventListener('DOMContentLoaded', function() {
            if (window.Prism) {
                Prism.highlightAll();
            }
        });
    </script>
</body>
</html>`;
        
        res.send(html);
        
    } catch (error) {
        console.error('개별 문제 페이지 생성 오류:', error);
        res.status(500).send('서버 오류가 발생했습니다.');
    }
});

module.exports = router; 