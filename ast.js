import { RubyNode } from './lib/rubynode.js';

export const ast = new RubyNode('begin', [
    new RubyNode('class', [
        new RubyNode('const', [
            null,
            'Range'
        ]),
        null,
        new RubyNode('begin', [
            new RubyNode('def', [
                'initialize',
                new RubyNode('args', [
                    new RubyNode('arg', ['start']),
                    new RubyNode('arg', ['r_end']),
                    new RubyNode('optarg', [
                        'step',
                        new RubyNode('int', [1])
                    ])
                ]),
                new RubyNode('begin', [
                    new RubyNode('ivasgn', [
                        '@start',
                        new RubyNode('lvar', ['start'])
                    ]),
                    new RubyNode('ivasgn', [
                        '@r_end',
                        new RubyNode('lvar', ['r_end'])
                    ]),
                    new RubyNode('ivasgn', [
                        '@step',
                        new RubyNode('lvar', ['step'])
                    ])
                ])
            ]),
            new RubyNode('def', [
                '[]',
                new RubyNode('args', [new RubyNode('arg', ['i'])]),
                new RubyNode('begin', [
                    new RubyNode('lvasgn', [
                        'x',
                        new RubyNode('send', [
                            new RubyNode('ivar', ['@start']),
                            '+',
                            new RubyNode('send', [
                                new RubyNode('lvar', ['i']),
                                '*',
                                new RubyNode('ivar', ['@step'])
                            ])
                        ])
                    ]),
                    new RubyNode('if', [
                        new RubyNode('send', [
                            new RubyNode('lvar', ['x']),
                            '<',
                            new RubyNode('ivar', ['@r_end'])
                        ]),
                        new RubyNode('return', [new RubyNode('lvar', ['x'])]),
                        null
                    ]),
                    new RubyNode('send', [
                        null,
                        'raise',
                        new RubyNode('send', [
                            new RubyNode('const', [
                                null,
                                'IndexError'
                            ]),
                            'new',
                            new RubyNode('str', ['Index out of range'])
                        ])
                    ])
                ])
            ]),
            new RubyNode('def', [
                'each',
                new RubyNode('args', [new RubyNode('blockarg', ['b'])]),
                new RubyNode('begin', [
                    new RubyNode('lvasgn', [
                        'x',
                        new RubyNode('ivar', ['@start'])
                    ]),
                    new RubyNode('while', [
                        new RubyNode('send', [
                            new RubyNode('lvar', ['x']),
                            '<',
                            new RubyNode('ivar', ['@r_end'])
                        ]),
                        new RubyNode('begin', [
                            new RubyNode('send', [
                                new RubyNode('lvar', ['b']),
                                'call',
                                new RubyNode('lvar', ['x'])
                            ]),
                            new RubyNode('op_asgn', [
                                new RubyNode('lvasgn', ['x']),
                                '+',
                                new RubyNode('ivar', ['@step'])
                            ])
                        ])
                    ])
                ])
            ])
        ])
    ]),
    new RubyNode('lvasgn', [
        'r',
        new RubyNode('send', [
            new RubyNode('const', [
                null,
                'Range'
            ]),
            'new',
            new RubyNode('int', [-100]),
            new RubyNode('int', [100]),
            new RubyNode('int', [3])
        ])
    ]),
    new RubyNode('block', [
        new RubyNode('send', [
            new RubyNode('lvar', ['r']),
            'each'
        ]),
        new RubyNode('args', [new RubyNode('procarg0', [new RubyNode('arg', ['n'])])]),
        new RubyNode('begin', [
            new RubyNode('if', [
                new RubyNode('send', [
                    new RubyNode('lvar', ['n']),
                    '<',
                    new RubyNode('int', [-40])
                ]),
                new RubyNode('next'),
                null
            ]),
            new RubyNode('if', [
                new RubyNode('send', [
                    new RubyNode('lvar', ['n']),
                    '>',
                    new RubyNode('int', [40])
                ]),
                new RubyNode('next'),
                null
            ]),
            new RubyNode('send', [
                null,
                'puts',
                new RubyNode('lvar', ['n'])
            ])
        ])
    ])
]);