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

// 개별 문제 페이지를 위한 SEO 친화적인 라우트 추가 (프리뷰 형태) - 더 구체적인 라우트를 먼저 정의
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
        
        // HTML 이스케이프 함수
        const escapeHtml = (text) => {
            if (!text) return '';
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/\n/g, '<br>');
        };
        
        // HTML 페이지 생성 (프리뷰 형태)
        const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(problem.content.substring(0, 50))}... | ${escapeHtml(subjectInfo.name)} | 쎈코딩</title>
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="${escapeHtml(problem.content.replace(/<[^>]*>/g, '').substring(0, 160))}...">
    <meta name="keywords" content="${escapeHtml(subjectInfo.name)}, 코딩문제, 프로그래밍, ${escapeHtml(subjectInfo.category || '코딩')}">
    <meta name="author" content="쎈코딩">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://ssencoding.com/problems/${escapeHtml(subject)}/problem/${id}">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${escapeHtml(problem.content.substring(0, 50))}... | ${escapeHtml(subjectInfo.name)}">
    <meta property="og:description" content="${escapeHtml(problem.content.replace(/<[^>]*>/g, '').substring(0, 160))}...">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://ssencoding.com/problems/${escapeHtml(subject)}/problem/${id}">
    <meta property="og:site_name" content="쎈코딩">
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="${escapeHtml(problem.content.substring(0, 50))}... | ${escapeHtml(subjectInfo.name)}">
    <meta name="twitter:description" content="${escapeHtml(problem.content.replace(/<[^>]*>/g, '').substring(0, 160))}...">
    
    <!-- Structured Data (JSON-LD) -->
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "${escapeHtml(problem.content.substring(0, 100))}...",
        "description": "${escapeHtml(problem.content.replace(/<[^>]*>/g, '').substring(0, 200))}...",
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
            "@id": "https://ssencoding.com/problems/${escapeHtml(subject)}/problem/${id}"
        },
        "about": {
            "@type": "Thing",
            "name": "${escapeHtml(subjectInfo.name)}"
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
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-makefile.min.js"></script>
    <script>
        // C# 언어 지원 명시적 등록
        if (window.Prism && window.Prism.languages) {
            window.Prism.languages.csharp = window.Prism.languages.extend('clike', {
                'keyword': /\\b(?:abstract|as|async|await|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|ref|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|virtual|void|volatile|while|yield)\\b/,
                'string': new RegExp('@?("|\')(\\\\1\\\\1|\\\\\\\\\\\\1|\\\\\\\\?(?!\\\\1)[\\\\s\\\\S])*\\\\1'),
                'number': /\\b0x[\\\\da-f]+\\b|(?:\\b\\\\d+\\\\.?\\\\d*|\\\\B\\\\.\\\\d+)(?:e[+-]?\\\\d+)?f?/i
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
                <h2>${escapeHtml(subjectInfo.name)} - 문제 미리보기</h2>
                <div class="problem-info-row">
                    <p>문제 ${id}</p>
                    <span class="difficulty-badge difficulty-${escapeHtml(problem.difficulty)}">${escapeHtml(problem.difficulty)}</span>
                </div>
            </div>
            
            <div class="problem-question">
                ${escapeHtml(problem.content)}
            </div>
            
            <div class="options-container">
                <div class="option">
                    <strong>A.</strong> ${escapeHtml(problem.option_a)}
                </div>
                <div class="option">
                    <strong>B.</strong> ${escapeHtml(problem.option_b)}
                </div>
                <div class="option">
                    <strong>C.</strong> ${escapeHtml(problem.option_c)}
                </div>
                <div class="option">
                    <strong>D.</strong> ${escapeHtml(problem.option_d)}
                </div>
            </div>
            
            <div class="explanation">
                <h3>정답: ${escapeHtml(problem.correct_answer)}</h3>
                <div class="explanation-content">
                    ${escapeHtml(problem.explanation || '설명이 없습니다.')}
                </div>
            </div>
            
            <div class="navigation-buttons" style="margin-top: 2rem;">
                <a href="/problems.html?subject=${escapeHtml(subject)}" class="nav-btn primary" style="text-decoration: none; padding: 12px 24px; background: #00d4aa; color: white; border-radius: 6px; font-weight: 500;">
                    🎯 이 과목 문제 풀기
                </a>
                <a href="/" class="nav-btn" style="text-decoration: none; padding: 12px 24px; background: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 6px; margin-left: 10px;">
                    🏠 홈으로 가기
                </a>
            </div>
            
            <div style="margin-top: 2rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #00d4aa;">
                <h4 style="margin: 0 0 0.5rem 0; color: #00d4aa;">💡 학습 팁</h4>
                <p style="margin: 0; color: #666; font-size: 0.9rem;">
                    이 문제를 포함한 ${escapeHtml(subjectInfo.name)} 과목의 모든 문제를 순차적으로 풀어보세요. 
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
                    // 마지막으로 푼 문제의 다음 문제를 찾기
                    const lastProblemIndex = problems.findIndex(p => p.id === progressData[0].last_problem_id);
                    if (lastProblemIndex !== -1 && lastProblemIndex < problems.length - 1) {
                        problemIndex = lastProblemIndex + 1;
                    } else if (lastProblemIndex === problems.length - 1) {
                        // 마지막 문제까지 다 푼 경우
                        problemIndex = problems.length - 1;
                    }
                }
            } catch (progressError) {
                console.error('진행상황 조회 오류:', progressError);
                // 진행상황 조회 실패 시 첫 번째 문제로 설정
            }
        }
        
        // 문제 번호 범위 확인
        if (problemIndex < 0) problemIndex = 0;
        if (problemIndex >= problems.length) problemIndex = problems.length - 1;
        
        const currentProblem = problems[problemIndex];
        const problemNumber = problemIndex + 1;
        
        res.json({
            success: true,
            subject: subjectInfo,
            problem: currentProblem,
            problemNumber: problemNumber,
            totalProblems: totalProblems,
            userProgress: req.user ? {
                lastProblemId: currentProblem.id,
                isCorrect: null,
                answeredAt: null
            } : null
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
                message: '문제 ID와 답안을 입력해주세요.' 
            });
        }

        // 문제 조회
        const [problems] = await pool.execute(
            'SELECT id, correct_answer, explanation FROM problems WHERE id = ?',
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

// 진행상황 저장 API
router.post('/save-progress', requireAuth, async (req, res) => {
    try {
        const { problemId, subject } = req.body;
        
        if (!problemId || !subject) {
            return res.status(400).json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        // 과목 ID 조회
        const [subjects] = await pool.execute(
            'SELECT id FROM subjects WHERE name = ?',
            [subject]
        );

        if (subjects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '과목을 찾을 수 없습니다.' 
            });
        }

        const subjectId = subjects[0].id;

        // 진행상황 저장
        await pool.execute(
            `INSERT INTO user_subject_progress (user_id, subject_id, last_problem_id) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             last_problem_id = VALUES(last_problem_id)`,
            [req.user.id, subjectId, problemId]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('진행상황 저장 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 과목별 진행상황 조회
router.get('/:subject/progress', async (req, res) => {
    try {
        const { subject } = req.params;
        const { id } = req.query;

        // 과목 정보 조회
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

        // 문제 목록 조회
        const [problems] = await pool.execute(
            'SELECT id, content, option_a, option_b, option_c, option_d, difficulty, correct_answer, explanation FROM problems WHERE subject_id = ? ORDER BY id',
            [subjectInfo.id]
        );

        if (problems.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '해당 과목에 문제가 없습니다.' 
            });
        }

        let problemIndex = 0;
        
        if (id && id !== 'null' && !isNaN(parseInt(id))) {
            problemIndex = parseInt(id) - 1;
        }

        if (problemIndex < 0) problemIndex = 0;
        if (problemIndex >= problems.length) problemIndex = problems.length - 1;

        const currentProblem = problems[problemIndex];
        const problemNumber = problemIndex + 1;

        res.json({
            success: true,
            subject: subjectInfo,
            problem: currentProblem,
            problemNumber: problemNumber,
            totalProblems: problems.length
        });

    } catch (error) {
        console.error('진행상황 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

// 틀린 문제 제거 API
router.post('/:subject/remove-wrong-problems', async (req, res) => {
    try {
        const { subject } = req.params;
        const { problemIds } = req.body;

        if (!problemIds || !Array.isArray(problemIds) || problemIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: '제거할 문제 ID 목록을 입력해주세요.' 
            });
        }

        // 과목 ID 조회
        const [subjects] = await pool.execute(
            'SELECT id FROM subjects WHERE name = ?',
            [subject]
        );

        if (subjects.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '과목을 찾을 수 없습니다.' 
            });
        }

        const subjectId = subjects[0].id;

        // 틀린 문제 제거
        await pool.execute(
            'DELETE FROM user_progress WHERE user_id = ? AND problem_id IN (SELECT id FROM problems WHERE subject_id = ? AND id IN (?))',
            [req.user.id, subjectId, problemIds]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('틀린 문제 제거 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '서버 오류가 발생했습니다.' 
        });
    }
});

module.exports = router;
