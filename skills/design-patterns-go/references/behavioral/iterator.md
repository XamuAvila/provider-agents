# Iterator (Go)

**Categoria:** Behavioral  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/iterator/go/example

## Intenção

O Iterador é um padrão de projeto comportamental que permite a passagem sequencial através de uma estrutura de dados complexa sem expor seus detalhes internos.

Graças ao Iterator, os clientes podem examinar elementos de diferentes coleções de maneira semelhante usando uma única interface iterador.

## Contexto do Exemplo

A ideia principal por trás do padrão Iterator é extrair a lógica de iteração de uma coleção em um objeto diferente denominado iterador. Este iterador fornece um método genérico de iteração sobre uma coleção independente de seu tipo.

## Implementação em Go

### `collection.go` — Coleção

```go
package main

type Collection interface {
	createIterator() Iterator
}
```

### `usercollection.go`

```go
package main

type UserCollection struct {
	users []*User
}

func (u *UserCollection) createIterator() Iterator {
	return &UserIterator{
		users: u.users,
	}
}
```

### `iterator.go` — Iterador

```go
package main

type Iterator interface {
	hasNext() bool
	getNext() *User
}
```

### `useriterator.go`

```go
package main

type UserIterator struct {
	index int
	users []*User
}

func (u *UserIterator) hasNext() bool {
	if u.index < len(u.users) {
		return true
	}
	return false

}
func (u *UserIterator) getNext() *User {
	if u.hasNext() {
		user := u.users[u.index]
		u.index++
		return user
	}
	return nil
}
```

### `user.go` — Código cliente

```go
package main

type User struct {
	name string
	age  int
}
```

### `main.go` — Código cliente

```go
package main

import "fmt"

func main() {

	user1 := &User{
		name: "a",
		age:  30,
	}
	user2 := &User{
		name: "b",
		age:  20,
	}

	userCollection := &UserCollection{
		users: []*User{user1, user2},
	}

	iterator := userCollection.createIterator()

	for iterator.hasNext() {
		user := iterator.getNext()
		fmt.Printf("User is %+v\n", user)
	}
}
```
