const express = require('express');
const { pool } = require('../config/database');

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

// 특정 과목의 문제 조회
router.get('/:subject', async (req, res) => {
    try {
        const { subject } = req.params;
        const { id } = req.query;

        console.log(`[DEBUG] 과목 문제 조회 요청: subject=${subject}, id=${id}, id type=${typeof id}, isNaN=${isNaN(parseInt(id))}`);

        // 과목 정보 조회 (공개된 과목만)
        const [subjects] = await pool.execute(
            'SELECT * FROM subjects WHERE name = ? AND is_public = TRUE',
            [subject]
        );

        if (subjects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '과목을 찾을 수 없습니다.' 
            });
        }

        const subjectInfo = subjects[0];

        // 모든 문제를 가져와서 순서로 선택
        const [problems] = await pool.execute(
            'SELECT * FROM problems WHERE subject_id = ? ORDER BY id',
            [subjectInfo.id]
        );
        
        // 해당 과목에 문제가 없는 경우
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
        } else {
            // 로그인한 사용자의 경우 마지막 진행 상황 확인
            console.log(`[DEBUG] id가 null이거나 유효하지 않음. 진행상황 복원 시도...`);
            if (req.isAuthenticated() && req.user && req.user.id) {
                try {
                    const [progress] = await pool.execute(
                        'SELECT last_problem_id FROM user_subject_progress WHERE user_id = ? AND subject_id = ?',
                        [req.user.id, subjectInfo.id]
                    );
                    
                    if (progress.length > 0) {
                        if (progress[0].last_problem_id) {
                            // 마지막으로 풀던 문제의 인덱스 찾기
                            const lastProblemIndex = problems.findIndex(p => p.id === progress[0].last_problem_id);
                            if (lastProblemIndex !== -1) {
                                // 마지막 문제가 이미 완료되었는지 확인
                                const [userProgress] = await pool.execute(
                                    'SELECT * FROM user_progress WHERE user_id = ? AND problem_id = ?',
                                    [req.user.id, progress[0].last_problem_id]
                                );
                                
                                if (userProgress.length > 0) {
                                    // 마지막 문제가 이미 완료되었으므로 다음 문제로 이동
                                    const nextIndex = lastProblemIndex + 1;
                                    if (nextIndex < problems.length) {
                                        problemIndex = nextIndex;
                                        console.log(`마지막 문제 완료됨, 다음 문제로 이동: 사용자 ${req.user.id}, 과목 ${subjectInfo.id}, 문제 ${progress[0].last_problem_id} → 다음 문제 (인덱스: ${problemIndex})`);
                                    } else {
                                        // 모든 문제를 다 풀었으므로 마지막 문제를 표시
                                        problemIndex = problems.length - 1;
                                        console.log(`모든 문제 완료됨, 마지막 문제 표시: 사용자 ${req.user.id}, 과목 ${subjectInfo.id} (인덱스: ${problemIndex})`);
                                    }
                                } else {
                                    // 마지막 문제가 아직 완료되지 않았으므로 해당 문제부터 시작
                                    problemIndex = lastProblemIndex;
                                    console.log(`진행 상황 복원: 사용자 ${req.user.id}, 과목 ${subjectInfo.id}, 문제 ${progress[0].last_problem_id} (인덱스: ${problemIndex})`);
                                }
                            } else {
                                // 저장된 문제가 현재 문제 목록에 없음 (삭제된 문제일 수 있음)
                                console.log(`저장된 문제 ${progress[0].last_problem_id}가 현재 문제 목록에 없음. 지능적 복원 시도...`);
                                
                                // 사용자가 이미 푼 문제들 조회 (성능 최적화)
                                if (problems.length > 0) {
                                    const [solvedProblems] = await pool.execute(
                                        'SELECT problem_id FROM user_progress WHERE user_id = ? AND problem_id IN (' + 
                                        problems.map(() => '?').join(',') + ')',
                                        [req.user.id, ...problems.map(p => p.id)]
                                    );
                                    
                                    const solvedIds = new Set(solvedProblems.map(p => p.problem_id));
                                    
                                    // 아직 풀지 않은 첫 번째 문제 찾기
                                    let foundUnsolvedIndex = -1;
                                    for (let i = 0; i < problems.length; i++) {
                                        if (!solvedIds.has(problems[i].id)) {
                                            foundUnsolvedIndex = i;
                                            break;
                                        }
                                    }
                                    
                                    if (foundUnsolvedIndex !== -1) {
                                        problemIndex = foundUnsolvedIndex;
                                        console.log(`첫 번째 미해결 문제로 복원: 인덱스 ${problemIndex}, 문제 ID ${problems[problemIndex].id}`);
                                        
                                        // 진행상황 업데이트
                                        await pool.execute(
                                            'UPDATE user_subject_progress SET last_problem_id = ? WHERE user_id = ? AND subject_id = ?',
                                            [problems[problemIndex].id, req.user.id, subjectInfo.id]
                                        );
                                    } else {
                                        // 모든 문제를 다 풀었다면 마지막 문제로
                                        problemIndex = problems.length - 1;
                                        console.log(`모든 문제 완료됨, 마지막 문제로 설정: 인덱스 ${problemIndex}`);
                                        
                                        // 진행상황 업데이트
                                        await pool.execute(
                                            'UPDATE user_subject_progress SET last_problem_id = ? WHERE user_id = ? AND subject_id = ?',
                                            [problems[problemIndex].id, req.user.id, subjectInfo.id]
                                        );
                                    }
                                } else {
                                    problemIndex = 0;
                                }
                            }
                        } else {
                            // last_problem_id가 NULL인 경우 (문제 삭제로 인해 NULL이 된 경우)
                            console.log(`진행상황이 NULL로 설정됨, 첫 번째 문제부터 시작: 사용자 ${req.user.id}, 과목 ${subjectInfo.id}`);
                            problemIndex = 0; // 첫 번째 문제부터 시작
                        }
                    }
                } catch (error) {
                    console.error('진행 상황 조회 오류:', error);
                }
            } else {
                console.log(`[DEBUG] 로그인되지 않은 사용자. 첫 번째 문제부터 시작.`);
            }
        }
        
        // problemIndex가 배열 범위를 벗어나는 경우 처리
        if (problemIndex >= problems.length) {
            // 모든 문제를 다 풀었으므로 마지막 문제를 표시
            problemIndex = problems.length - 1;
            console.log(`problemIndex가 범위를 벗어남, 마지막 문제로 조정: ${problemIndex}`);
        } else if (problemIndex < 0) {
            // 인덱스가 음수인 경우 첫 번째 문제로
            problemIndex = 0;
            console.log(`problemIndex가 음수, 첫 번째 문제로 조정: ${problemIndex}`);
        }
        
        const problem = problems[problemIndex];

        if (!problem) {
            return res.status(404).json({ 
                success: false, 
                message: '문제를 찾을 수 없습니다.' 
            });
        }

        // 전체 문제 수 조회
        const [countResult] = await pool.execute(
            'SELECT COUNT(*) as total FROM problems WHERE subject_id = ?',
            [subjectInfo.id]
        );
        const totalProblems = countResult[0].total;

        // 사용자 진행상황 조회 (로그인된 경우)
        let userProgress = null;
        if (req.isAuthenticated() && req.user && req.user.id) {
            const [progress] = await pool.execute(
                'SELECT * FROM user_progress WHERE user_id = ? AND problem_id = ?',
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
            problemNumber: problemIndex + 1, // 1-based index
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

// 답안 제출
router.post('/:subject/submit', async (req, res) => {
    try {
        const { subject } = req.params;
        const { problemId, answer } = req.body;

        if (!problemId || !answer) {
            return res.status(400).json({ 
                success: false, 
                message: '문제 ID와 답안을 입력해주세요.' 
            });
        }

        // 문제 조회
        const [problems] = await pool.execute(
            'SELECT * FROM problems WHERE id = ?',
            [problemId]
        );

        if (problems.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '문제를 찾을 수 없습니다.' 
            });
        }

        const problem = problems[0];
        
        // 프론트엔드에서 1,2,3,4 형식으로 보내므로 A,B,C,D로 변환해서 비교
        const answerMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        const dbAnswer = answerMap[answer] || answer.toUpperCase();
        const isCorrect = dbAnswer === problem.correct_answer;
        
        console.log(`답안 검증: 받은 답안=${answer}, 변환된 답안=${dbAnswer}, 정답=${problem.correct_answer}, 결과=${isCorrect}`);

        // 사용자 진행상황 저장 (로그인된 경우)
        if (req.isAuthenticated() && req.user && req.user.id) {
            try {
                // 문제 풀이 기록 저장
                await pool.execute(
                    `INSERT INTO user_progress (user_id, problem_id, selected_answer, is_correct) 
                     VALUES (?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE 
                     selected_answer = VALUES(selected_answer), 
                     is_correct = VALUES(is_correct),
                     answered_at = CURRENT_TIMESTAMP`,
                    [req.user.id, problemId, dbAnswer, isCorrect]
                );
                
                // 과목별 마지막 진행 상황 저장
                await pool.execute(
                    `INSERT INTO user_subject_progress (user_id, subject_id, last_problem_id) 
                     VALUES (?, ?, ?) 
                     ON DUPLICATE KEY UPDATE 
                     last_problem_id = VALUES(last_problem_id)`,
                    [req.user.id, problem.subject_id, problemId]
                );
            } catch (error) {
                console.error('진행상황 저장 오류:', error);
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
router.post('/:subject/wrong-submit', async (req, res) => {
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

// 진행 상황 저장 (페이지 벗어날 때)
router.post('/save-progress', async (req, res) => {
    try {
        const { problemId, subject } = req.body;
        
        if (!req.isAuthenticated() || !req.user || !req.user.id || !problemId) {
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

module.exports = router; 