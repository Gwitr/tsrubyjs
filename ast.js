import { RubyNode } from './lib/rubynode.js';

export const ast = new RubyNode('begin', [
    new RubyNode('class', [
        new RubyNode('const', [
            null,
            'A'
        ]),
        null,
        new RubyNode('def', [
            'f',
            new RubyNode('args'),
            new RubyNode('send', [
                null,
                'puts',
                new RubyNode('str', ['f'])
            ])
        ])
    ]),
    new RubyNode('class', [
        new RubyNode('const', [
            null,
            'B'
        ]),
        new RubyNode('const', [
            null,
            'A'
        ]),
        new RubyNode('def', [
            'f3',
            new RubyNode('args'),
            new RubyNode('send', [
                null,
                'puts',
                new RubyNode('str', ['f3'])
            ])
        ])
    ]),
    new RubyNode('class', [
        new RubyNode('const', [
            null,
            'A'
        ]),
        null,
        new RubyNode('def', [
            'f2',
            new RubyNode('args'),
            new RubyNode('send', [
                null,
                'puts',
                new RubyNode('str', ['f2'])
            ])
        ])
    ]),
    new RubyNode('lvasgn', [
        'x',
        new RubyNode('send', [
            new RubyNode('const', [
                null,
                'A'
            ]),
            'new'
        ])
    ]),
    new RubyNode('send', [
        new RubyNode('lvar', ['x']),
        'f'
    ]),
    new RubyNode('send', [
        new RubyNode('lvar', ['x']),
        'f2'
    ]),
    new RubyNode('lvasgn', [
        'x',
        new RubyNode('send', [
            new RubyNode('const', [
                null,
                'B'
            ]),
            'new'
        ])
    ]),
    new RubyNode('send', [
        new RubyNode('lvar', ['x']),
        'f'
    ]),
    new RubyNode('send', [
        new RubyNode('lvar', ['x']),
        'f3'
    ]),
    new RubyNode('send', [
        new RubyNode('lvar', ['x']),
        'f2'
    ])
]);